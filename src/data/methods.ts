import type { PaymentMethod } from './types';

/** Couleurs officielles des opérateurs : on ne les recolore jamais. */
export const methods: Record<PaymentMethod, { label: string; short: string; color: string }> = {
  cash: { label: 'Espèces', short: 'Espèces', color: '#64748B' },
  orange: { label: 'Orange Money', short: 'Orange', color: '#FF7900' },
  mtn: { label: 'MTN MoMo', short: 'MTN', color: '#FFCB05' },
  wave: { label: 'Wave', short: 'Wave', color: '#1DC3F0' },
  moov: { label: 'Moov Money', short: 'Moov', color: '#0066B3' },
  /** Impayé réglé en retenant sur la caution au départ (jamais proposé à l'encaissement) */
  caution: { label: 'Retenue sur caution', short: 'Caution', color: '#C2410C' },
};

export const methodOrder: PaymentMethod[] = ['cash', 'wave', 'orange', 'mtn', 'moov'];
