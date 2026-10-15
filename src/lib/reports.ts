import { expenseCategories, expenseCategoryIds, expenseMethods, formatRate } from '@/data/expenses';
import { methods } from '@/data/methods';
import type { PropertyReport, Report, ReportTotals } from '@/data/report';
import type { Identity, Profile } from '@/data/store';
import type { Expense, Payment, Property, Tenant, Unit } from '@/data/types';

import { amountWords, branding, esc, header, page } from './documents';
import { formatAmount, formatDate, formatNumber, formatPeriod, formatPhone } from './format';
import type { Sheet } from './xlsx';

/** Relevé de gestion, compte rendu du propriétaire (PDF) et export Excel, à partir du calcul `buildReport`. */

export type ReportData = {
  report: Report;
  identity?: Identity;
  profile: Profile;
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  payments: Payment[];
  expenses: Expense[];
};

/** "2026-01" → "2026-10" : « janvier – octobre 2026 », « octobre 2026 », « décembre 2025 – mars 2026 » */
export function periodLabel(from: string, to: string): string {
  if (from === to) return formatPeriod(from);
  const [fm, fy] = formatPeriod(from).split(' ');
  return fy === to.slice(0, 4) ? `${fm} – ${formatPeriod(to)}` : `${formatPeriod(from)} – ${formatPeriod(to)}`;
}

const n = (v: number) => (v < 0 ? `<span class="neg">${formatNumber(v)}</span>` : formatNumber(v));

/** Dépenses et paiements de la période, pour les biens du rapport */
function rowsOf({ report, properties, units, tenants, payments, expenses }: ReportData) {
  const ids = new Set(report.properties.map((p) => p.id));
  const inRange = (period: string) => period >= report.from && period <= report.to;
  const unitById = new Map(units.map((u) => [u.id, u]));
  const tenantById = new Map(tenants.map((t) => [t.id, t]));
  const propertyName = (id: string) => properties.find((p) => p.id === id)?.name ?? '';
  const monthOf = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  return {
    expenses: expenses
      .filter((e) => ids.has(e.propertyId) && inRange(monthOf(e.date)))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => ({ ...e, propertyName: propertyName(e.propertyId), unitLabel: e.unitId ? unitById.get(e.unitId)?.label : undefined })),
    payments: payments
      .flatMap((p) => {
        const tenant = tenantById.get(p.tenantId);
        const unit = tenant ? unitById.get(tenant.unitId) : undefined;
        if (!tenant || !unit || !ids.has(unit.propertyId) || !inRange(p.period)) return [];
        return [{ ...p, tenant, unit, propertyName: propertyName(unit.propertyId) }];
      })
      .sort((a, b) => a.period.localeCompare(b.period) || a.date.localeCompare(b.date)),
  };
}

function totalsTable(t: ReportTotals) {
  return `<table>
    <tr><td>Loyers dus</td><td class="v">${formatAmount(t.expected)}</td></tr>
    <tr><td>Loyers encaissés</td><td class="v">${formatAmount(t.collected)}</td></tr>
    <tr><td>Reste dû par les locataires</td><td class="v">${formatAmount(t.outstanding)}</td></tr>
    <tr><td>Dépenses</td><td class="v">− ${formatAmount(t.expenses)}</td></tr>
    <tr class="total"><td>Net (encaissé − dépenses)</td><td class="v">${formatAmount(t.net)}</td></tr>
  </table>`;
}

function monthsTable(p: PropertyReport) {
  const rows = p.months
    .map(
      (m) =>
        `<tr><td class="t">${esc(formatPeriod(m.period))}</td><td>${n(m.expected)}</td><td>${n(m.collected)}</td><td>${n(m.outstanding)}</td><td>${n(m.expenses)}</td><td>${n(m.net)}</td></tr>`,
    )
    .join('');
  const t = p.totals;
  return `<table class="grid"><tr><th>Mois</th><th>Dû</th><th>Encaissé</th><th>Reste dû</th><th>Dépenses</th><th>Net</th></tr>${rows}
    <tr class="total"><td class="t">Total</td><td>${n(t.expected)}</td><td>${n(t.collected)}</td><td>${n(t.outstanding)}</td><td>${n(t.expenses)}</td><td>${n(t.net)}</td></tr></table>`;
}

function categoriesTable(t: ReportTotals) {
  const rows = expenseCategoryIds
    .filter((k) => t.expensesByCategory[k])
    .map((k) => `<tr><td class="t">${esc(expenseCategories[k].label)}</td><td>${n(t.expensesByCategory[k]!)}</td></tr>`)
    .join('');
  return rows ? `<table class="grid"><tr><th>Catégorie</th><th>Montant</th></tr>${rows}</table>` : '';
}

function expensesTable(list: ReturnType<typeof rowsOf>['expenses'], withProperty: boolean) {
  if (!list.length) return '<p>Aucune dépense sur la période.</p>';
  const rows = list
    .map(
      (e) =>
        `<tr><td class="t">${esc(formatDate(e.date))}</td>${withProperty ? `<td class="t">${esc(e.propertyName)}</td>` : ''}<td class="t">${esc(
          expenseCategories[e.category].short,
        )}${e.unitLabel ? ` · ${esc(e.unitLabel)}` : ''}</td><td class="t">${esc([e.supplier, e.note].filter(Boolean).join(' — '))}</td><td>${n(e.amount)}</td></tr>`,
    )
    .join('');
  return `<table class="grid"><tr><th>Date</th>${withProperty ? '<th>Bien</th>' : ''}<th>Catégorie</th><th>Détail</th><th>Montant</th></tr>${rows}</table>`;
}

const foot = (brandName: string) =>
  `<div class="foot">Loyers comptés pour le mois qu’ils règlent ; dépenses pour le mois de leur date. Montants en francs CFA. Établi par ${esc(
    brandName,
  )} avec Kaza le ${esc(formatDate(new Date().toISOString()))}.</div>`;

/** Relevé de gestion : tous les biens choisis, mois par mois. */
export function statementHtml(data: ReportData): string {
  const { report, identity, profile } = data;
  const brand = branding(identity, profile);
  const who = brand ? brand.name : `${profile.firstName} ${profile.lastName}`.trim();
  const { expenses } = rowsOf(data);
  const label = periodLabel(report.from, report.to);
  const perProperty = report.properties
    .map((p) => `<div class="avoid"><h2>${esc(p.name)}</h2>${monthsTable(p)}</div>`)
    .join('');
  const body = `${header('Relevé de gestion', label, brand)}
    <div class="parties"><div class="box"><div class="label">Bailleur</div><b>${esc(who)}</b>${
      brand?.lines.length ? `<br>${brand.lines.map(esc).join('<br>')}` : profile.phone ? `<br>${esc(formatPhone(profile.phone))}` : ''
    }</div><div class="box"><div class="label">Période</div><b>${esc(label)}</b><br>${report.properties.length} bien${
      report.properties.length > 1 ? 's' : ''
    }</div></div>
    <div class="amount"><div class="label">Net de la période</div><div class="fig">${formatAmount(report.totals.net)}</div></div>
    ${totalsTable(report.totals)}
    ${perProperty}
    ${report.totals.expenses ? `<h2>Dépenses par catégorie</h2>${categoriesTable(report.totals)}<h2>Détail des dépenses</h2>${expensesTable(expenses, report.properties.length > 1)}` : ''}
    ${foot(who)}`;
  return page(`Relevé ${label}`, body, brand);
}

/** Compte rendu au propriétaire d'un ou plusieurs biens gérés : encaissé − commission − dépenses = montant dû. */
export function landlordStatementHtml(data: ReportData, landlord: { name: string; phone?: string }): string {
  const { report, identity, profile } = data;
  const brand = branding(identity, profile);
  const who = brand ? brand.name : `${profile.firstName} ${profile.lastName}`.trim();
  const { expenses, payments } = rowsOf(data);
  const label = periodLabel(report.from, report.to);
  const t = report.totals;
  const lines = report.properties
    .map(
      (p) =>
        `<tr><td class="t">${esc(p.name)}</td><td>${n(p.totals.collected)}</td><td>${p.commissionBps ? `${n(-p.totals.commission)} <small>(${formatRate(p.commissionBps)})</small>` : '0'}</td><td>${n(-p.totals.expenses)}</td><td>${n(p.totals.dueToLandlord)}</td></tr>`,
    )
    .join('');
  const paymentRows = payments
    .map(
      (p) =>
        `<tr><td class="t">${esc(formatPeriod(p.period))}</td><td class="t">${esc(`${p.tenant.firstName} ${p.tenant.lastName}`)} · ${esc(p.unit.label)}${
          report.properties.length > 1 ? ` <small>(${esc(p.propertyName)})</small>` : ''
        }</td><td class="t">${esc(formatDate(p.date))} · ${esc(methods[p.method].label)}</td><td>${n(p.amount)}</td></tr>`,
    )
    .join('');
  const due = t.dueToLandlord;
  const body = `${header('Compte rendu de gestion', label, brand)}
    <div class="parties">
      <div class="box"><div class="label">Gestionnaire</div><b>${esc(who)}</b>${brand?.lines.length ? `<br>${brand.lines.map(esc).join('<br>')}` : ''}</div>
      <div class="box"><div class="label">Propriétaire</div><b>${esc(landlord.name)}</b>${landlord.phone ? `<br>${esc(formatPhone(landlord.phone))}` : ''}</div>
    </div>
    <div class="amount"><div class="label">${due >= 0 ? 'Montant dû au propriétaire' : 'Reste à la charge du propriétaire'}</div><div class="fig">${formatAmount(Math.abs(due))}</div><div class="words">${esc(amountWords(Math.abs(due)))}</div></div>
    <table class="grid"><tr><th>Bien</th><th>Encaissé</th><th>Commission</th><th>Dépenses</th><th>Dû</th></tr>${lines}
      <tr class="total"><td class="t">Total</td><td>${n(t.collected)}</td><td>${n(-t.commission)}</td><td>${n(-t.expenses)}</td><td>${n(due)}</td></tr></table>
    <p>Loyers dus sur la période : ${formatAmount(t.expected)} · reste dû par les locataires : <b>${formatAmount(t.outstanding)}</b>.</p>
    <div class="avoid"><h2>Loyers encaissés</h2>${paymentRows ? `<table class="grid"><tr><th>Mois</th><th>Locataire</th><th>Reçu le</th><th>Montant</th></tr>${paymentRows}</table>` : '<p>Aucun loyer encaissé sur la période.</p>'}</div>
    <h2>Dépenses</h2>${expensesTable(expenses, report.properties.length > 1)}
    ${report.properties.map((p) => `<div class="avoid"><h2>${esc(p.name)} : mois par mois</h2>${monthsTable(p)}</div>`).join('')}
    ${foot(who)}`;
  return page(`Compte rendu ${landlord.name} ${label}`, body, brand);
}

/** Message WhatsApp qui accompagne le compte rendu */
export function landlordSummaryText(report: Report, landlordName: string, managerName: string): string {
  const t = report.totals;
  return [
    `Bonjour ${landlordName},`,
    `voici le compte rendu de gestion de ${periodLabel(report.from, report.to)} :`,
    `• Loyers encaissés : ${formatAmount(t.collected)}`,
    t.commission ? `• Commission : − ${formatAmount(t.commission)}` : null,
    t.expenses ? `• Dépenses : − ${formatAmount(t.expenses)}` : null,
    `• Montant dû : ${formatAmount(t.dueToLandlord)}`,
    t.outstanding ? `Reste dû par les locataires : ${formatAmount(t.outstanding)}.` : null,
    `Le détail est dans le document joint. ${managerName}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Classeur Excel : synthèse, mois par mois, paiements, dépenses. */
export function reportSheets(data: ReportData): Sheet[] {
  const { report } = data;
  const { expenses, payments } = rowsOf(data);
  const day = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };
  return [
    {
      name: 'Synthèse',
      widths: [30, 14, 14, 14, 14, 14, 12, 16],
      rows: [
        ['Bien', 'Loyers dus', 'Encaissés', 'Reste dû', 'Dépenses', 'Net', 'Commission', 'Dû au propriétaire'],
        ...report.properties.map((p) => [
          p.name,
          p.totals.expected,
          p.totals.collected,
          p.totals.outstanding,
          p.totals.expenses,
          p.totals.net,
          p.totals.commission,
          p.totals.dueToLandlord,
        ]),
        [
          'Total',
          report.totals.expected,
          report.totals.collected,
          report.totals.outstanding,
          report.totals.expenses,
          report.totals.net,
          report.totals.commission,
          report.totals.dueToLandlord,
        ],
      ],
    },
    {
      name: 'Par mois',
      widths: [30, 10, 14, 14, 14, 14, 14],
      rows: [
        ['Bien', 'Mois', 'Loyers dus', 'Encaissés', 'Reste dû', 'Dépenses', 'Net'],
        ...report.properties.flatMap((p) => p.months.map((m) => [p.name, m.period, m.expected, m.collected, m.outstanding, m.expenses, m.net])),
      ],
    },
    {
      name: 'Paiements',
      widths: [12, 10, 26, 14, 24, 14, 12],
      rows: [
        ['Reçu le', 'Mois réglé', 'Bien', 'Unité', 'Locataire', 'Moyen', 'Montant'],
        ...payments.map((p) => [day(p.date), p.period, p.propertyName, p.unit.label, `${p.tenant.firstName} ${p.tenant.lastName}`, methods[p.method].label, p.amount]),
      ],
    },
    {
      name: 'Dépenses',
      widths: [12, 26, 12, 24, 22, 30, 14, 12],
      rows: [
        ['Date', 'Bien', 'Unité', 'Catégorie', 'Fournisseur', 'Note', 'Payé par', 'Montant'],
        ...expenses.map((e) => [
          day(e.date),
          e.propertyName,
          e.unitLabel ?? '',
          expenseCategories[e.category].label,
          e.supplier ?? '',
          e.note ?? '',
          expenseMethods[e.method].label,
          e.amount,
        ]),
      ],
    },
  ];
}
