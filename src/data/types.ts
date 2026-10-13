import type { RentStatus } from '@/theme/tokens';

export type PaymentMethod = 'cash' | 'orange' | 'mtn' | 'wave' | 'moov';

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
