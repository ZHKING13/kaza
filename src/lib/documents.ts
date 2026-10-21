import { byMethod, methods } from '@/data/methods';
import { brandColor } from '@/data/brand';
import type { Identity, Profile } from '@/data/store';
import type { Payment, Property, Settlement, Tenant, Unit } from '@/data/types';

import { formatAmount, formatDateLong as formatDate, formatPeriod, formatPhone } from './format';
import { numberToWords } from './words';

/** Documents PDF (quittance, reçu partiel, solde de tout compte), rendus en HTML puis imprimés par expo-print. */

const DEFAULT_TEAL = '#0F766E';
const OCRE = '#C2410C';
const INK = '#0F172A';
const MUTED = '#475569';

const LOGO = `<svg width="34" height="34" viewBox="0 0 48 48" aria-label="Kaza"><path fill-rule="evenodd" fill="${DEFAULT_TEAL}" d="M8 22.5 22 10.8a3 3 0 0 1 3.9 0L40 22.5V38a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3Z M19 41V31a5 5 0 0 1 10 0v10Z"/><circle cx="24" cy="21.5" r="3.2" fill="${OCRE}"/></svg>`;

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fullName = (p: { firstName: string; lastName: string }) => esc(`${p.firstName} ${p.lastName}`.trim());
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const amountWords = (n: number) => `${capitalize(numberToWords(n))} francs CFA`;

/** "Awa Koné", "octobre 2026" -> "Awa-Kone-octobre-2026" */
export function slug(...parts: string[]): string {
  return parts
    .join(' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Numéro stable dérivé du paiement : Q-202610-7F3A */
export function receiptNumber(payment: Payment): string {
  let h = 0;
  for (const ch of payment.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `Q-${payment.period.replace('-', '')}-${h.toString(16).toUpperCase().slice(-4).padStart(4, '0')}`;
}

/** Identité de l'espace telle qu'imprimée ; null : document par défaut (marque Kaza). */
export type Branding = {
  name: string;
  lines: string[];
  color: { main: string; soft: string; line: string };
  logo?: string;
  stamp?: string;
  footer: string | null;
} | null;

export function branding(identity: Identity | undefined, profile: Profile): Branding {
  if (!identity) return null;
  const lines = [
    identity.address,
    [identity.phone, identity.email].filter(Boolean).join(' · '),
    identity.registrationNumber ? `RCCM ${identity.registrationNumber}` : null,
    identity.taxId ? `N° fiscal ${identity.taxId}` : null,
  ].filter((l): l is string => !!l);
  const branded =
    !!identity.legalName || lines.length > 0 || !!identity.logo || !!identity.stamp || !!identity.receiptFooter || identity.brandColor !== 'teal';
  if (!branded) return null;
  return {
    name: identity.legalName || `${profile.firstName} ${profile.lastName}`.trim(),
    lines,
    color: brandColor(identity.brandColor),
    logo: identity.logo,
    stamp: identity.stamp,
    footer: identity.receiptFooter,
  };
}

export function page(title: string, body: string, brand: Branding = null) {
  const TEAL = brand?.color.main ?? DEFAULT_TEAL;
  const SOFT = brand?.color.soft ?? '#F0FDFA';
  const LINE = brand?.color.line ?? '#99F6E4';
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif; color: ${INK}; font-size: 12.5px; line-height: 1.5; margin: 0; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid ${TEAL}; padding-bottom: 14px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand b { font-size: 22px; letter-spacing: -0.02em; }
  .doc { text-align: right; }
  .doc h1 { margin: 0; font-size: 20px; color: ${TEAL}; }
  .doc .no { color: ${MUTED}; font-size: 11.5px; margin-top: 2px; }
  .parties { display: flex; gap: 16px; margin: 20px 0; }
  .box { flex: 1; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 12px; }
  .label { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: ${MUTED}; margin-bottom: 4px; }
  .amount { background: ${SOFT}; border: 1px solid ${LINE}; border-radius: 10px; padding: 14px 16px; margin: 6px 0 18px; }
  .amount .fig { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .amount .words { color: ${MUTED}; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 18px; }
  td { padding: 7px 0; border-bottom: 1px solid #E2E8F0; vertical-align: top; }
  td.v { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tr.total td { border-bottom: 0; border-top: 2px solid ${INK}; font-size: 14px; padding-top: 10px; }
  .statement { margin: 14px 0 26px; }
  .warn { color: #B91C1C; }
  .sign { display: flex; justify-content: space-between; margin-top: 30px; }
  .sign .line { margin-top: 46px; border-top: 1px solid ${INK}; width: 200px; padding-top: 4px; color: ${MUTED}; font-size: 11px; }
  .brand img { max-height: 54px; max-width: 200px; object-fit: contain; }
  .brand .name { font-size: 17px; font-weight: 700; color: ${TEAL}; max-width: 260px; }
  .stamp { display: block; max-height: 90px; max-width: 200px; object-fit: contain; margin: 0 0 -38px auto; }
  .note { margin-top: 18px; font-style: italic; }
  .foot { margin-top: 36px; color: ${MUTED}; font-size: 10px; border-top: 1px solid #E2E8F0; padding-top: 8px; }
  h2 { font-size: 15px; margin: 22px 0 4px; color: ${TEAL}; }
  table.grid { font-size: 11.5px; margin-top: 4px; }
  table.grid th { text-align: right; font-size: 10px; letter-spacing: .04em; text-transform: uppercase; color: ${MUTED}; font-weight: 600; padding: 6px 0 6px 8px; border-bottom: 1px solid ${INK}; }
  table.grid th:first-child, table.grid td:first-child { text-align: left; padding-left: 0; }
  table.grid td { text-align: right; padding: 5px 0 5px 8px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  table.grid td.t { text-align: left; white-space: normal; }
  table.grid tr.total td { font-weight: 700; font-size: 12px; }
  .neg { color: #B91C1C; }
  .avoid { page-break-inside: avoid; }
</style></head><body>${body}</body></html>`;
}

export function header(title: string, number: string, brand: Branding = null) {
  const mark = !brand
    ? `${LOGO}<b>kaza</b>`
    : brand.logo
      ? `<img src="${brand.logo}" alt="${esc(brand.name)}">`
      : `<span class="name">${esc(brand.name)}</span>`;
  return `<div class="head"><div class="brand">${mark}</div><div class="doc"><h1>${esc(title)}</h1><div class="no">${esc(number)}</div></div></div>`;
}

/** Nom du bailleur sur le document : la raison sociale si elle est renseignée. */
const landlordName = (profile: Profile, brand: Branding) => (brand ? esc(brand.name) : fullName(profile));

function parties(profile: Profile, tenant: Tenant, unit: Unit, property: Property, brand: Branding = null) {
  const landlord = brand
    ? `<b>${esc(brand.name)}</b><br>${(brand.lines.length ? brand.lines : [formatPhone(profile.phone)]).map(esc).join('<br>')}`
    : `<b>${fullName(profile)}</b><br>${esc(formatPhone(profile.phone))}`;
  return `<div class="parties">
    <div class="box"><div class="label">Bailleur</div>${landlord}</div>
    <div class="box"><div class="label">Locataire</div><b>${fullName(tenant)}</b><br>${esc(formatPhone(tenant.phone))}</div>
  </div>
  <div class="box" style="margin-bottom:16px"><div class="label">Logement</div><b>${esc(unit.label)}</b> · ${esc(property.name)}<br>${esc(property.district)}, ${esc(property.city)}</div>`;
}

type ReceiptArgs = {
  /** Identité de l'espace imprimée sur le document */
  identity?: Identity;
  payment: Payment;
  /** Total reçu pour la période, ce paiement compris */
  paidForPeriod: number;
  dueForPeriod: number;
  tenant: Tenant;
  unit: Unit;
  property: Property;
  profile: Profile;
};

/** Quittance si la période est soldée, sinon reçu de paiement partiel (une quittance ne se délivre que pour un loyer payé en entier). */
export function receiptHtml({ identity, payment, paidForPeriod, dueForPeriod, tenant, unit, property, profile }: ReceiptArgs) {
  const brand = branding(identity, profile);
  const who = landlordName(profile, brand);
  const full = paidForPeriod >= dueForPeriod;
  const title = full ? 'Quittance de loyer' : 'Reçu de paiement partiel';
  const period = formatPeriod(payment.period);
  const statement = full
    ? `Je soussigné(e) <b>${who}</b>, bailleur du logement désigné ci-dessus, déclare avoir reçu de <b>${fullName(tenant)}</b> la somme de <b>${esc(formatAmount(payment.amount))}</b> au titre du loyer de <b>${esc(period)}</b>, et lui en donne quittance, sous réserve de tous mes droits.`
    : `Je soussigné(e) <b>${who}</b>, bailleur du logement désigné ci-dessus, déclare avoir reçu de <b>${fullName(tenant)}</b> la somme de <b>${esc(formatAmount(payment.amount))}</b> en paiement partiel du loyer de <b>${esc(period)}</b>. <span class="warn">Reste dû pour cette période : <b>${esc(formatAmount(dueForPeriod - paidForPeriod))}</b>.</span> Ce reçu ne vaut pas quittance.`;
  return page(
    `${title} ${period}`,
    `${header(title, `N° ${receiptNumber(payment)}`, brand)}
    ${parties(profile, tenant, unit, property, brand)}
    <div class="label">Montant reçu</div>
    <div class="amount"><div class="fig">${esc(formatAmount(payment.amount))}</div><div class="words">${esc(amountWords(payment.amount))}</div></div>
    <table>
      <tr><td>Période</td><td class="v">${esc(capitalize(period))}</td></tr>
      <tr><td>Loyer de la période</td><td class="v">${esc(formatAmount(dueForPeriod))}</td></tr>
      <tr><td>Total reçu pour la période</td><td class="v">${esc(formatAmount(paidForPeriod))}</td></tr>
      <tr><td>Mode de paiement</td><td class="v">${esc(methods[payment.method].label)}</td></tr>
      <tr><td>Date du paiement</td><td class="v">${esc(formatDate(payment.date))}</td></tr>
    </table>
    <p class="statement">${statement}</p>
    <div class="sign"><div>Fait à ${esc(property.city)}, le ${esc(formatDate(new Date().toISOString()))}</div><div>${stamp(brand)}<div class="line">Le bailleur · ${who}</div></div></div>
    ${brand?.footer ? `<p class="note">${esc(brand.footer)}</p>` : ''}
    <div class="foot">Document établi avec Kaza. À conserver par le locataire.</div>`,
    brand,
  );
}

const stamp = (brand: Branding) => (brand?.stamp ? `<img class="stamp" src="${brand.stamp}" alt="Cachet">` : '');

type SettlementArgs = {
  identity?: Identity;
  settlement: Settlement;
  exitDate: string;
  tenant: Tenant;
  unit: Unit;
  property: Property;
  profile: Profile;
};

export function settlementHtml({ identity, settlement: s, exitDate, tenant, unit, property, profile }: SettlementArgs) {
  const brand = branding(identity, profile);
  const row = (label: string, amount: number, sign: '+' | '−') =>
    `<tr><td>${esc(label)}</td><td class="v">${sign} ${esc(formatAmount(amount))}</td></tr>`;
  const refund = s.balance >= 0;
  return page(
    'Solde de tout compte',
    `${header('Solde de tout compte', `Départ le ${formatDate(exitDate)}`, brand)}
    ${parties(profile, tenant, unit, property, brand)}
    <table>
      ${tenant.entryDate ? `<tr><td>Entrée dans le logement</td><td class="v">${esc(formatDate(tenant.entryDate))}</td></tr>` : ''}
      <tr><td>Départ</td><td class="v">${esc(formatDate(exitDate))}</td></tr>
    </table>
    <table>
      ${row('Caution versée', s.deposit, '+')}
      ${s.prepaid > 0 ? row('Avance non consommée', s.prepaid, '+') : ''}
      ${s.arrearsDeducted > 0 ? row('Impayés retenus sur la caution', s.arrearsDeducted, '−') : ''}
      ${s.deductions.filter((d) => d.amount > 0).map((d) => row(d.label || 'Retenue', d.amount, '−')).join('')}
      <tr class="total"><td><b>${refund ? 'À rembourser au locataire' : 'Reste dû par le locataire'}</b></td><td class="v">${esc(formatAmount(Math.abs(s.balance)))}</td></tr>
    </table>
    <p class="statement">${esc(amountWords(Math.abs(s.balance)))}${refund && s.refundMethod ? `, remboursés ${esc(byMethod(s.refundMethod))}` : ''}.</p>
    ${s.arrearsLeft > 0 && s.arrearsDeducted === 0 ? `<p class="statement warn">Impayés non retenus sur la caution : ${esc(formatAmount(s.arrearsLeft))} restent dus.</p>` : ''}
    <p class="statement">Les parties reconnaissent que ce solde arrête définitivement les comptes entre elles pour la location désignée ci-dessus.</p>
    <div class="sign"><div>${stamp(brand)}<div class="line">Le bailleur · ${landlordName(profile, brand)}</div></div><div><div class="line">Le locataire · ${fullName(tenant)}</div></div></div>
    ${brand?.footer ? `<p class="note">${esc(brand.footer)}</p>` : ''}
    <div class="foot">Document établi avec Kaza le ${esc(formatDate(new Date().toISOString()))}.</div>`,
    brand,
  );
}

type InvoiceArgs = {
  invoice: {
    number: string | null;
    planLabel: string;
    months: number;
    amount: number;
    /** Offre de bienvenue : réduction en % et prix normal */
    welcomePercent?: number;
    fullAmount?: number;
    paidAt: string | null;
    periodStart: string | null;
    periodEnd: string | null;
  };
  /** Client : l'espace (raison sociale si renseignée) */
  customer: { name: string; lines: string[] };
};

/** Facture d'abonnement Kaza (payée). */
export function invoiceHtml({ invoice, customer }: InvoiceArgs) {
  const period =
    invoice.periodStart && invoice.periodEnd
      ? `du ${formatDate(invoice.periodStart)} au ${formatDate(invoice.periodEnd)}`
      : `${invoice.months} mois`;
  return page(
    `Facture ${invoice.number ?? ''}`,
    `${header('Facture', invoice.number ? `N° ${invoice.number}` : '')}
    <div class="parties">
      <div class="box"><div class="label">Émise par</div><b>Kaza</b><br>Gestion locative</div>
      <div class="box"><div class="label">Client</div><b>${esc(customer.name)}</b>${customer.lines.map((l) => `<br>${esc(l)}`).join('')}</div>
    </div>
    <table>
      <tr><td>Abonnement Kaza, offre ${esc(invoice.planLabel)} (${invoice.months} mois)</td><td class="v">${esc(formatAmount(invoice.fullAmount ?? invoice.amount))}</td></tr>
      ${
        invoice.welcomePercent && invoice.fullAmount
          ? `<tr><td>Offre de bienvenue (−${invoice.welcomePercent} %)</td><td class="v">− ${esc(formatAmount(invoice.fullAmount - invoice.amount))}</td></tr>`
          : ''
      }
      <tr><td>Période</td><td class="v">${esc(period)}</td></tr>
      <tr class="total"><td><b>Total payé</b></td><td class="v">${esc(formatAmount(invoice.amount))}</td></tr>
    </table>
    <p class="statement">${esc(amountWords(invoice.amount))}, payés par mobile money${invoice.paidAt ? ` le ${esc(formatDate(invoice.paidAt))}` : ''}.</p>
    <div class="foot">Facture établie par Kaza.</div>`,
  );
}
