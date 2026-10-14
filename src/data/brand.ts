/**
 * Couleurs de quittance : mêmes valeurs que `brandColors` de @zhking13/kaza-domain 0.5.0.
 * `soft` : fond de l'encadré du montant ; `line` : sa bordure.
 */
export const brandColors = {
  teal: { label: 'Vert d’eau', main: '#0F766E', soft: '#F0FDFA', line: '#99F6E4' },
  green: { label: 'Vert', main: '#15803D', soft: '#F0FDF4', line: '#BBF7D0' },
  blue: { label: 'Bleu', main: '#1D4ED8', soft: '#EFF6FF', line: '#BFDBFE' },
  indigo: { label: 'Indigo', main: '#4338CA', soft: '#EEF2FF', line: '#C7D2FE' },
  red: { label: 'Rouge', main: '#B91C1C', soft: '#FEF2F2', line: '#FECACA' },
  orange: { label: 'Orange', main: '#C2410C', soft: '#FFF7ED', line: '#FED7AA' },
  brown: { label: 'Brun', main: '#854D0E', soft: '#FEFCE8', line: '#FDE68A' },
  slate: { label: 'Ardoise', main: '#334155', soft: '#F8FAFC', line: '#CBD5E1' },
} as const;

export type BrandColor = keyof typeof brandColors;

export function brandColor(key: string | null | undefined) {
  return brandColors[(key && key in brandColors ? key : 'teal') as BrandColor];
}
