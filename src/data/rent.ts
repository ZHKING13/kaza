import { periodOf } from '@/lib/format';

import type { Tenant, Unit } from './types';

/**
 * Loyer daté et fin de bail : mêmes règles que @zhking13/kaza-domain 0.4.0 (rent.ts, lease-end.ts).
 * Dates calendaires « YYYY-MM-DD », périodes « YYYY-MM ».
 */

/** Un montant de loyer, valable à partir du mois `from` jusqu'au palier suivant. */
export type RentStep = { from: string; amount: number };

/** Montant fixe, ou échéancier daté (loyer d'entrée puis révisions). */
export type Rent = number | readonly RentStep[];

export function rentSteps(rent: Rent): RentStep[] {
  if (typeof rent === 'number') return [{ from: '0000-01', amount: rent }];
  const sorted = [...rent].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  return sorted.filter((s, i) => sorted[i + 1]?.from !== s.from);
}

/** Loyer du mois `period`. Avant le premier palier, c'est le premier montant qui s'applique. */
export function rentAt(rent: Rent, period: string): number {
  if (typeof rent === 'number') return rent;
  const steps = rentSteps(rent);
  if (steps.length === 0) return 0;
  let amount = steps[0].amount;
  for (const s of steps) {
    if (s.from > period) break;
    amount = s.amount;
  }
  return amount;
}

/** Mois du dernier changement de loyer effectif au mois `period` (le mois d'entrée sans révision). */
export function lastRentChange(rent: Rent, period: string): string | undefined {
  if (typeof rent === 'number') return undefined;
  const past = rentSteps(rent).filter((s) => s.from <= period);
  for (let i = past.length - 1; i > 0; i--) {
    if (past[i].amount !== past[i - 1].amount) return past[i].from;
  }
  return past[0]?.from;
}

/** "2026-11" + 2 -> "2027-01" */
export function addMonthsToPeriod(period: string, n: number): string {
  const [y, m] = period.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Loyer inchangé depuis au moins `months` mois, sans révision prévue (0 : alerte coupée). */
export function rentRevisionDue(rent: Rent, period: string, months: number): boolean {
  if (months <= 0 || typeof rent === 'number') return false;
  if (rentSteps(rent).some((s) => s.from > period)) return false;
  const since = lastRentChange(rent, period);
  return !!since && addMonthsToPeriod(since, months) <= period;
}

/** "2026-01-31" + 1 mois -> "2026-02-28" */
export function addMonthsToDate(date: string, months: number): string {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  const total = year * 12 + (month - 1) + months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

/** Jours calendaires de `from` à `to` ("YYYY-MM-DD"). */
export function daysBetween(from: string, to: string): number {
  const utc = (d: string) => {
    const [y, m, day] = d.slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

export type NoticeFrom = 'tenant' | 'landlord';

/** Préavis par défaut et seuils des alertes (réglages de l'espace). */
export type LeaseSettings = {
  noticeTenantMonths: number;
  noticeLandlordMonths: number;
  leaseEndAlertDays: number;
  /** 0 : alerte « Révision de loyer » coupée */
  rentRevisionAlertMonths: number;
};

export const defaultLeaseSettings: LeaseSettings = {
  noticeTenantMonths: 1,
  noticeLandlordMonths: 3,
  leaseEndAlertDays: 60,
  rentRevisionAlertMonths: 12,
};

export function noticeExitDate(noticeDate: string, from: NoticeFrom, settings: LeaseSettings = defaultLeaseSettings): string {
  return addMonthsToDate(noticeDate, from === 'tenant' ? settings.noticeTenantMonths : settings.noticeLandlordMonths);
}

/** Échéance de fin d'un bail vue d'aujourd'hui : préavis, fin de contrat proche, contrat échu. */
export type LeaseEnd = { kind: 'notice' | 'contract_end' | 'contract_expired'; date: string; daysLeft: number };

export function leaseEnd(
  lease: { endDate?: string | null; notice?: { exitDate: string } | null; exitDate?: string | null },
  today: string,
  withinDays: number,
): LeaseEnd | null {
  if (lease.exitDate) return null;
  if (lease.notice) {
    const daysLeft = daysBetween(today, lease.notice.exitDate);
    return daysLeft <= withinDays ? { kind: 'notice', date: lease.notice.exitDate.slice(0, 10), daysLeft } : null;
  }
  if (!lease.endDate) return null;
  const daysLeft = daysBetween(today, lease.endDate);
  if (daysLeft < 0) return { kind: 'contract_expired', date: lease.endDate.slice(0, 10), daysLeft };
  return daysLeft <= withinDays ? { kind: 'contract_end', date: lease.endDate.slice(0, 10), daysLeft } : null;
}

/** Date calendaire "YYYY-MM-DD" (heure locale) d'une date ISO de l'application. */
export const toCalendar = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Échéancier du loyer d'un locataire : loyer d'entrée (à défaut, celui du logement) puis révisions.
 * Le mois d'entrée sert de point de départ.
 */
export function tenantRent(tenant: Pick<Tenant, 'rent' | 'rents' | 'entryDate'>, unit: Pick<Unit, 'rent'>): RentStep[] {
  const from = tenant.entryDate ? periodOf(new Date(tenant.entryDate)) : '0000-01';
  return [{ from, amount: tenant.rent ?? unit.rent }, ...(tenant.rents ?? []).map((r) => ({ from: r.from, amount: r.amount }))];
}

/** "YYYY-MM-DD" -> date ISO à midi heure locale (format des dates de l'application). */
export const fromCalendar = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toISOString();
};
