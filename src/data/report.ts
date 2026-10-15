import { periodsBetween } from '@/lib/dates';
import { periodOf } from '@/lib/format';

import { type ProrataRule, rentForPeriod } from './prorata';
import type { Rent } from './rent';
import type { ExpenseCategory } from './types';

/**
 * Relevé et compte rendu de gestion : même calcul que `buildReport` de @zhking13/kaza-domain 0.7.0.
 * Les paiements comptent pour le mois qu'ils règlent ; les dépenses pour le mois de leur date.
 */
export type ReportProperty = { id: string; name: string; commissionBps?: number | null };
export type ReportLease = { id: string; propertyId: string; rent: Rent; entryDate?: string; exitDate?: string | null };
export type ReportPayment = { leaseId: string; amount: number; period: string };
/** `date` : ISO ou "YYYY-MM-DD" */
export type ReportExpense = { propertyId: string; amount: number; category: ExpenseCategory; date: string };

export type ReportFigures = { expected: number; collected: number; outstanding: number; expenses: number; net: number };
export type ReportTotals = ReportFigures & {
  expensesByCategory: Partial<Record<ExpenseCategory, number>>;
  commission: number;
  dueToLandlord: number;
};
export type PropertyReport = {
  id: string;
  name: string;
  commissionBps: number;
  months: (ReportFigures & { period: string })[];
  totals: ReportTotals;
};
export type Report = { from: string; to: string; periods: string[]; properties: PropertyReport[]; totals: ReportTotals };

const zero = (): ReportFigures => ({ expected: 0, collected: 0, outstanding: 0, expenses: 0, net: 0 });
/** Mois d'une date : "YYYY-MM-DD" tel quel, ISO lue en heure locale */
const periodOfDate = (date: string) => (/^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : periodOf(new Date(date)));

export function commissionOf(collected: number, bps: number): number {
  return Math.round((collected * bps) / 10_000);
}

function totalsOf(months: ReportFigures[], byCategory: ReportTotals['expensesByCategory'], commission: number): ReportTotals {
  const sum = months.reduce(
    (t, m) => ({
      expected: t.expected + m.expected,
      collected: t.collected + m.collected,
      outstanding: t.outstanding + m.outstanding,
      expenses: t.expenses + m.expenses,
      net: t.net + m.net,
    }),
    zero(),
  );
  return { ...sum, expensesByCategory: byCategory, commission, dueToLandlord: sum.collected - commission - sum.expenses };
}

export function buildReport({
  properties,
  leases,
  payments,
  expenses,
  from,
  to,
  rule = 'full',
}: {
  properties: ReportProperty[];
  leases: ReportLease[];
  payments: ReportPayment[];
  expenses: ReportExpense[];
  from: string;
  to: string;
  rule?: ProrataRule;
}): Report {
  const periods = periodsBetween(from, to);
  const inRange = (period: string) => period >= from && period <= to;
  const paid = new Map<string, number>();
  for (const p of payments) {
    if (!inRange(p.period)) continue;
    const key = `${p.leaseId}|${p.period}`;
    paid.set(key, (paid.get(key) ?? 0) + p.amount);
  }

  const reports = properties.map((property): PropertyReport => {
    const mine = leases.filter((l) => l.propertyId === property.id);
    const spent = expenses.filter((e) => e.propertyId === property.id && inRange(periodOfDate(e.date)));
    const byCategory: ReportTotals['expensesByCategory'] = {};
    for (const e of spent) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    const months = periods.map((period) => {
      const m = zero();
      for (const lease of mine) {
        const due = rentForPeriod(lease.rent, period, rule, lease.entryDate, lease.exitDate ?? undefined).amount;
        const got = paid.get(`${lease.id}|${period}`) ?? 0;
        m.expected += due;
        m.collected += got;
        m.outstanding += Math.max(due - got, 0);
      }
      m.expenses = spent.filter((e) => periodOfDate(e.date) === period).reduce((s, e) => s + e.amount, 0);
      m.net = m.collected - m.expenses;
      return { period, ...m };
    });
    const bps = property.commissionBps ?? 0;
    const collected = months.reduce((s, m) => s + m.collected, 0);
    return { id: property.id, name: property.name, commissionBps: bps, months, totals: totalsOf(months, byCategory, commissionOf(collected, bps)) };
  });

  const byCategory: ReportTotals['expensesByCategory'] = {};
  for (const r of reports)
    for (const [k, v] of Object.entries(r.totals.expensesByCategory) as [ExpenseCategory, number][])
      byCategory[k] = (byCategory[k] ?? 0) + v;
  const months = periods.map((period, i) => {
    const m = zero();
    for (const r of reports) {
      const x = r.months[i];
      m.expected += x.expected;
      m.collected += x.collected;
      m.outstanding += x.outstanding;
      m.expenses += x.expenses;
      m.net += x.net;
    }
    return m;
  });
  return {
    from,
    to,
    periods,
    properties: reports,
    totals: totalsOf(months, byCategory, reports.reduce((s, r) => s + r.totals.commission, 0)),
  };
}
