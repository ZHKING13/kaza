import type { RentStatus } from '@/theme/tokens';

export type PaymentMethod = 'cash' | 'orange' | 'mtn' | 'wave' | 'moov' | 'caution';

export type PropertyType = 'cour' | 'immeuble' | 'villa' | 'magasin';

export type Property = {
  id: string;
  name: string;
  type: PropertyType;
  district: string;
  city: string;
  /** URI locale de la photo, facultative */
  photo?: string;
  description?: string;
};

export type Unit = {
  id: string;
  propertyId: string;
  label: string;
  rent: number;
};

export type Tenant = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  unitId: string;
  /** Jour du mois où le loyer est dû */
  dueDay: number;
  /** Mois d'avance encore à consommer */
  advanceMonthsLeft: number;
  /** Caution versée à l'entrée, en mois de loyer (remboursable) */
  depositMonths: number;
  /** Date d'entrée dans le logement (ISO) */
  entryDate?: string;
  /** Date de départ (ISO) : le locataire devient un ancien locataire */
  exitDate?: string;
  settlement?: Settlement;
};

/** Solde de tout compte établi au départ du locataire. */
export type Settlement = {
  deposit: number;
  prepaid: number;
  /** Impayés retenus sur la caution */
  arrearsDeducted: number;
  /** Impayés laissés à la charge du locataire */
  arrearsLeft: number;
  deductions: { label: string; amount: number }[];
  /** > 0 : à rembourser au locataire ; < 0 : le locataire doit encore ce montant */
  balance: number;
  refundMethod?: PaymentMethod;
};

export type Payment = {
  id: string;
  tenantId: string;
  amount: number;
  method: PaymentMethod;
  /** ISO date */
  date: string;
  /** Mois couvert, "YYYY-MM" */
  period: string;
  /** Payé en ligne par le locataire (lien de paiement mobile money) */
  online?: boolean;
};

export type TenantSummary = {
  tenant: Tenant;
  unit: Unit;
  property: Property;
  status: RentStatus;
  paid: number;
  due: number;
  dueDate: string;
};
