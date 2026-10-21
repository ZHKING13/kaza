import { periodsBetween } from '@/lib/dates';
import { periodOf } from '@/lib/format';

import { type ProrataRule, rentForPeriod } from './prorata';
import { addMonthsToPeriod, type Rent } from './rent';

/**
 * Répartition d'un encaissement sur plusieurs mois : même règle que `allocatePayment` de @zhking13/kaza-domain 0.8.0.
 * Les impayés plus anciens que le mois choisi d'abord, puis le mois choisi et les suivants, jamais au-delà du loyer
 * d'un mois, au plus 12 mois après le mois en cours ni après le départ.
 */
export const maxAdvanceMonths = 12;

export type LeaseMonth = { period: string; due: number; paid: number; remaining: number };
export type AllocationPart = { period: string; amount: number; due: number; paidBefore: number; settles: boolean };

type Input = {
  rent: Rent;
  rule?: ProrataRule;
  /** ISO */
  entryDate?: string;
  exitDate?: string;
  payments: { period: string; amount: number }[];
  currentPeriod: string;
};

export function leaseMonths({ rent, rule = 'full', entryDate, exitDate, payments, currentPeriod }: Input): LeaseMonth[] {
  const first = entryDate ? periodOf(new Date(entryDate)) : payments.reduce((min, p) => (p.period < min ? p.period : min), currentPeriod);
  const limit = addMonthsToPeriod(currentPeriod, maxAdvanceMonths);
  const exit = exitDate ? periodOf(new Date(exitDate)) : null;
  const last = exit && exit < limit ? exit : limit;
  return periodsBetween(first, last).map((period) => {
    const due = rentForPeriod(rent, period, rule, entryDate, exitDate).amount;
    const paid = payments.filter((p) => p.period === period).reduce((s, p) => s + p.amount, 0);
    return { period, due, paid, remaining: Math.max(due - paid, 0) };
  });
}

export function allocatePayment(input: Input & { startPeriod?: string; amount: number }) {
  const months = leaseMonths(input);
  const lastPeriod = months.length ? months[months.length - 1].period : input.currentPeriod;
  const startPeriod = input.startPeriod ?? months.find((m) => m.remaining > 0)?.period ?? input.currentPeriod;
  const order = [
    ...months.filter((m) => m.period < startPeriod && m.remaining > 0),
    ...months.filter((m) => m.period >= startPeriod && m.remaining > 0),
  ];
  let left = input.amount;
  const parts: AllocationPart[] = [];
  for (const m of order) {
    if (left <= 0) break;
    const amount = Math.min(m.remaining, left);
    parts.push({ period: m.period, amount, due: m.due, paidBefore: m.paid, settles: amount === m.remaining });
    left -= amount;
  }
  parts.sort((a, b) => (a.period < b.period ? -1 : 1));
  return { parts, left, lastPeriod, startPeriod, months };
}
