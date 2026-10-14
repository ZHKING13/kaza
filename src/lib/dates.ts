import { periodOf } from './format';

/** Minuit local du jour donné. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Périodes "YYYY-MM" de `from` à `to` inclus (vide si `from` > `to`). */
export function periodsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const [fy, fm] = from.split('-').map(Number);
  let d = new Date(fy, fm - 1, 1);
  while (periodOf(d) <= to) {
    out.push(periodOf(d));
    d = addMonths(d, 1);
  }
  return out;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
