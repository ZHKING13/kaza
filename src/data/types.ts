import type { RentStatus } from '@/theme/tokens';

export type PaymentMethod = 'cash' | 'orange' | 'mtn' | 'wave' | 'moov';

export type Property = {
  id: string;
  name: string;
  district: string;
  city: string;
};

export type Lot = {
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
  lotId: string;
  /** Jour du mois où le loyer est dû */
  dueDay: number;
  /** Mois d'avance encore à consommer */
  advanceMonthsLeft: number;
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
  lot: Lot;
  property: Property;
  status: RentStatus;
  paid: number;
  due: number;
  dueDate: string;
};
