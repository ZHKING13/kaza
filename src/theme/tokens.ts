// Kaza design tokens — source: design-system/kaza/MASTER.md

export const palette = {
  light: {
    primary: '#0F766E',
    primaryPressed: '#115E59',
    onPrimary: '#FFFFFF',
    primarySoft: '#CCFBF1',
    accent: '#C2410C',
    onAccent: '#FFFFFF',
    bg: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceAlt: '#F1F5F9',
    border: '#E2E8F0',
    text: '#0F172A',
    textMuted: '#475569',
    textDisabled: '#94A3B8',
  },
  dark: {
    primary: '#2DD4BF',
    primaryPressed: '#5EEAD4',
    onPrimary: '#042F2E',
    primarySoft: '#134E4A',
    accent: '#FB923C',
    onAccent: '#1C0A02',
    bg: '#0B1220',
    surface: '#111A2B',
    surfaceAlt: '#172238',
    border: '#25324A',
    text: '#F1F5F9',
    textMuted: '#94A3B8',
    textDisabled: '#55627A',
  },
} as const;

export type RentStatus = 'paid' | 'partial' | 'late' | 'upcoming' | 'vacant';

export const status: Record<
  'light' | 'dark',
  Record<RentStatus, { fg: string; bg: string; label: string; icon: string }>
> = {
  light: {
    paid: { fg: '#166534', bg: '#DCFCE7', label: 'Payé', icon: 'circle-check' },
    partial: { fg: '#92400E', bg: '#FEF3C7', label: 'Partiel', icon: 'circle-dashed' },
    late: { fg: '#B91C1C', bg: '#FEE2E2', label: 'En retard', icon: 'circle-alert' },
    upcoming: { fg: '#1D4ED8', bg: '#DBEAFE', label: 'À venir', icon: 'clock' },
    vacant: { fg: '#475569', bg: '#F1F5F9', label: 'Vacant', icon: 'door-open' },
  },
  dark: {
    paid: { fg: '#86EFAC', bg: 'rgba(34,197,94,0.15)', label: 'Payé', icon: 'circle-check' },
    partial: { fg: '#FCD34D', bg: 'rgba(245,158,11,0.15)', label: 'Partiel', icon: 'circle-dashed' },
    late: { fg: '#FCA5A5', bg: 'rgba(239,68,68,0.15)', label: 'En retard', icon: 'circle-alert' },
    upcoming: { fg: '#93C5FD', bg: 'rgba(59,130,246,0.15)', label: 'À venir', icon: 'clock' },
    vacant: { fg: '#CBD5E1', bg: 'rgba(148,163,184,0.15)', label: 'Vacant', icon: 'door-open' },
  },
};

export const fonts = {
  regular: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semibold: 'IBMPlexSans_600SemiBold',
  bold: 'IBMPlexSans_700Bold',
} as const;

const tabular = { fontVariant: ['tabular-nums' as const] };

export const type = {
  amountXL: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 40, ...tabular },
  h1: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 32 },
  h2: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 28 },
  h3: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24, ...tabular },
  small: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 16, letterSpacing: 0.2 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, ...tabular },
} as const;

export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, x3: 40, x4: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 20, full: 999 } as const;
export const touch = { min: 48 } as const;
export const motion = { fast: 150, base: 200, slow: 250 } as const;

export const elevation = {
  none: {},
  raised: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
} as const;

/** 125000 -> "125 000 FCFA" (espace insécable) */
export function formatAmount(value: number, currency = 'FCFA'): string {
  const n = Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return `${n}\u00A0${currency}`;
}
