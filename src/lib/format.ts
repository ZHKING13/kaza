import { countries, groupDigits } from '@/data/countries';

const NBSP = '\u00A0';

/** 125000 -> "125 000" (espace insécable entre les milliers) */
export function formatNumber(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** 125000 -> "125 000 FCFA" */
export function formatAmount(value: number, currency = 'FCFA'): string {
  return `${formatNumber(value)}${NBSP}${currency}`;
}

const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** "5 oct. 2026" */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** "5 oct." */
export function formatDayMonth(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "2026-10" -> "octobre 2026" */
export function formatPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "+2250712345678" -> "+225 07 12 34 56 78", "+221771234567" -> "+221 77 123 45 67" */
export function formatPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  const country = countries.find((c) => digits.startsWith(c.dial));
  if (!country) return e164;
  return `+${country.dial} ${groupDigits(digits.slice(country.dial.length), country.groups)}`;
}

export function initials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

export function periodOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** 1 -> "1er", 13 -> "13" */
export function dayLabel(day: number): string {
  return day === 1 ? '1er' : String(day);
}
