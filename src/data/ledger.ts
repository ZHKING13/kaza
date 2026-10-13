import { periodOf } from '@/lib/format';
import { periodsBetween } from '@/lib/dates';

import { type ProrataRule, rentForPeriod } from './prorata';
import type { Payment, Tenant } from './types';

export type Balance = {
  /** Reste dû par mois, du début du bail au mois de départ inclus */
  arrearsByPeriod: { period: string; amount: number }[];
  arrears: number;
  /** Paiements déjà reçus pour des mois après le départ (avance non consommée) */
  prepaidPayments: Payment[];
  prepaid: number;
};

/** Compte du locataire arrêté au mois `untilPeriod` (et à `exitDate` pour le prorata du dernier mois). */
export function tenantBalance(
  tenant: Tenant,
  rent: number,
  payments: Payment[],
  untilPeriod: string,
  rule: ProrataRule = 'full',
  exitDate?: string,
): Balance {
  const mine = payments.filter((p) => p.tenantId === tenant.id);
  const firstPaid = mine.reduce<string | undefined>((min, p) => (!min || p.period < min ? p.period : min), undefined);
  const start = tenant.entryDate ? periodOf(new Date(tenant.entryDate)) : (firstPaid ?? untilPeriod);

  const arrearsByPeriod = periodsBetween(start, untilPeriod)
    .map((period) => ({
      period,
      amount: Math.max(
        rentForPeriod(rent, period, rule, tenant.entryDate, exitDate).amount -
          mine.filter((p) => p.period === period).reduce((s, p) => s + p.amount, 0),
        0,
      ),
    }))
    .filter((x) => x.amount > 0);

  const prepaidPayments = mine.filter((p) => p.period > untilPeriod);
  return {
    arrearsByPeriod,
    arrears: arrearsByPeriod.reduce((s, x) => s + x.amount, 0),
    prepaidPayments,
    prepaid: prepaidPayments.reduce((s, p) => s + p.amount, 0),
  };
}

export type SettlementInput = {
  tenant: Tenant;
  rent: number;
  payments: Payment[];
  exitDate: string;
  deductArrears: boolean;
  deductions: { label: string; amount: number }[];
  rule?: ProrataRule;
};

/**
 * Solde de tout compte : caution + avance non consommée − impayés retenus − retenues.
 * Si les impayés dépassent ce qui est disponible, le solde devient négatif (le locataire doit).
 */
export function computeSettlement({ tenant, rent, payments, exitDate, deductArrears, deductions, rule = 'full' }: SettlementInput) {
  const b = tenantBalance(tenant, rent, payments, periodOf(new Date(exitDate)), rule, exitDate);
  const deposit = tenant.depositMonths * rent;
  const available = deposit + b.prepaid;
  const arrearsDeducted = deductArrears ? Math.min(b.arrears, available) : 0;
  const unpaidBeyondDeposit = deductArrears ? b.arrears - arrearsDeducted : 0;
  const other = deductions.reduce((s, d) => s + d.amount, 0);
  return {
    balanceDetail: b,
    deposit,
    prepaid: b.prepaid,
    arrearsDeducted,
    arrearsLeft: b.arrears - arrearsDeducted,
    deductions,
    balance: available - arrearsDeducted - unpaidBeyondDeposit - other,
  };
}
