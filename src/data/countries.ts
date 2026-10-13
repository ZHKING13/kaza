/** Indicatifs des pays cibles et longueur du numéro national (sans indicatif). */
export const countries = [
  { code: 'CI', name: 'Côte d’Ivoire', dial: '225', length: 10, groups: [2, 2, 2, 2, 2] },
  { code: 'SN', name: 'Sénégal', dial: '221', length: 9, groups: [2, 3, 2, 2] },
  { code: 'CM', name: 'Cameroun', dial: '237', length: 9, groups: [3, 2, 2, 2] },
  { code: 'BJ', name: 'Bénin', dial: '229', length: 10, groups: [2, 2, 2, 2, 2] },
  { code: 'TG', name: 'Togo', dial: '228', length: 8, groups: [2, 2, 2, 2] },
  { code: 'ML', name: 'Mali', dial: '223', length: 8, groups: [2, 2, 2, 2] },
  { code: 'BF', name: 'Burkina Faso', dial: '226', length: 8, groups: [2, 2, 2, 2] },
] as const;

export type Country = (typeof countries)[number];

/** Découpe un numéro saisi ou importé ("+225 07 12…", "0712…") en pays + numéro national. */
export function splitPhone(raw: string, fallback: Country): { country: Country; national: string } {
  const digits = raw.replace(/\D/g, '');
  const withPlus = raw.trim().startsWith('+') || raw.trim().startsWith('00');
  const clean = raw.trim().startsWith('00') ? digits.slice(2) : digits;
  if (withPlus) {
    const c = countries.find((x) => clean.startsWith(x.dial));
    if (c) return { country: c, national: clean.slice(c.dial.length) };
  }
  return { country: fallback, national: digits };
}

/** Groupe les chiffres selon l'usage du pays : CI "07 12 34 56 78", SN "77 123 45 67". */
export function groupDigits(national: string, groups: readonly number[] = [2, 2, 2, 2, 2]): string {
  const out: string[] = [];
  let i = 0;
  for (const g of groups) {
    if (i >= national.length) break;
    out.push(national.slice(i, i + g));
    i += g;
  }
  if (i < national.length) out.push(national.slice(i));
  return out.join(' ');
}
