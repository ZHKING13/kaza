const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const TENS = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

/** 0-99 en lettres (orthographe traditionnelle : « soixante et onze », « quatre-vingts »). */
function below100(n: number, final: boolean): string {
  if (n <= 16) return UNITS[n];
  if (n < 20) return `dix-${UNITS[n - 10]}`;
  const t = Math.floor(n / 10);
  const u = n % 10;
  if (t === 7 || t === 9) {
    const base = t === 7 ? 'soixante' : 'quatre-vingt';
    const rest = 10 + u;
    if (t === 7 && u === 1) return 'soixante et onze';
    return `${base}-${below100(rest, false)}`;
  }
  if (t === 8) return u === 0 ? (final ? 'quatre-vingts' : 'quatre-vingt') : `quatre-vingt-${UNITS[u]}`;
  if (u === 0) return TENS[t];
  if (u === 1) return `${TENS[t]} et un`;
  return `${TENS[t]}-${UNITS[u]}`;
}

/** 0-999 en lettres. `final` : le groupe termine le nombre (accord de « cents » et « vingts »). */
function below1000(n: number, final: boolean): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h === 1) parts.push('cent');
  else if (h > 1) parts.push(`${UNITS[h]} ${r === 0 && final ? 'cents' : 'cent'}`);
  if (r > 0 || h === 0) parts.push(below100(r, final));
  return parts.join(' ');
}

/** Entier positif en toutes lettres, en français : 120000 -> « cent vingt mille ». */
export function numberToWords(value: number): string {
  let n = Math.round(Math.abs(value));
  if (n === 0) return 'zéro';
  const millions = Math.floor(n / 1_000_000);
  n %= 1_000_000;
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (millions) parts.push(`${below1000(millions, true)} ${millions > 1 ? 'millions' : 'million'}`);
  if (thousands) parts.push(thousands === 1 ? 'mille' : `${below1000(thousands, false)} mille`);
  if (rest) parts.push(below1000(rest, true));
  return parts.join(' ');
}
