import { type Rent, rentAt } from './rent';

/**
 * Loyer dû pour un mois d'entrée ou de départ incomplet.
 * - full  : mois complet, quel que soit le jour (usage le plus courant)
 * - daily : au jour près, arrondi à 5 FCFA
 * - half  : demi-loyer si l'entrée a lieu après le 15, ou le départ au plus tard le 15
 */
export type ProrataRule = 'full' | 'daily' | 'half';

export const prorataRules: Record<ProrataRule, { label: string; hint: string }> = {
  full: { label: 'Mois complet', hint: 'Le mois d’entrée et le mois de départ sont dus en entier.' },
  daily: { label: 'Au jour près', hint: 'Seuls les jours occupés sont dus, arrondis à 5 FCFA.' },
  half: { label: 'Demi-mois', hint: 'Entrée après le 15 ou départ au plus tard le 15 : la moitié du loyer.' },
};

export type PeriodRent = {
  amount: number;
  /** Premier et dernier jour occupés dans le mois (1-31) */
  fromDay: number;
  toDay: number;
  daysInMonth: number;
  /** Vrai si le montant diffère d'un mois complet */
  partial: boolean;
};

const round5 = (n: number) => Math.round(n / 5) * 5;

export function rentForPeriod(
  schedule: Rent,
  period: string,
  rule: ProrataRule,
  entryDate?: string,
  exitDate?: string,
): PeriodRent {
  const rent = rentAt(schedule, period);
  const [y, m] = period.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const inMonth = (iso?: string) => {
    if (!iso) return undefined;
    const d = new Date(iso);
    return d.getFullYear() === y && d.getMonth() === m - 1 ? d.getDate() : undefined;
  };
  const before = (iso?: string) => !!iso && `${new Date(iso).getFullYear()}-${String(new Date(iso).getMonth() + 1).padStart(2, '0')}` > period;
  const after = (iso?: string) => !!iso && `${new Date(iso).getFullYear()}-${String(new Date(iso).getMonth() + 1).padStart(2, '0')}` < period;

  // Mois avant l'entrée ou après le départ : rien n'est dû
  if (before(entryDate) || after(exitDate)) return { amount: 0, fromDay: 0, toDay: 0, daysInMonth, partial: true };

  const fromDay = inMonth(entryDate) ?? 1;
  const toDay = inMonth(exitDate) ?? daysInMonth;
  const full = { amount: rent, fromDay, toDay, daysInMonth, partial: false };
  if (rule === 'full' || (fromDay === 1 && toDay === daysInMonth)) return full;

  if (rule === 'daily') {
    const days = Math.max(toDay - fromDay + 1, 0);
    return { amount: round5((rent * days) / daysInMonth), fromDay, toDay, daysInMonth, partial: days < daysInMonth };
  }

  // half
  const halfEntry = fromDay > 15;
  const halfExit = toDay <= 15;
  return halfEntry || halfExit ? { ...full, amount: round5(rent / 2), partial: true } : full;
}
