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
  /** Propriétaire du bien (mandant) quand l'espace le gère pour lui */
  landlordName?: string;
  landlordPhone?: string;
  /** Commission du gestionnaire sur les loyers encaissés, en points de base (750 = 7,5 %) */
  commissionBps?: number;
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
  /** Loyer à l'entrée (à défaut : celui du logement) ; les révisions sont dans `rents` */
  rent?: number;
  /** Révisions du loyer, de la plus ancienne à la plus récente (passées et prévues) */
  rents?: RentRevision[];
  /** Fin du contrat prévue (ISO) ; absente : durée indéterminée */
  endDate?: string;
  /** Préavis en cours */
  notice?: Notice;
  settlement?: Settlement;
  /** Lien de l'espace locataire (compte en ligne, bail en cours) */
  portalUrl?: string;
};

/** Révision du loyer : `amount` à partir du mois `from` ("YYYY-MM"). */
export type RentRevision = { id: string; from: string; amount: number; reason?: string };

/** Préavis : qui l'a donné, quand, départ prévu (dates ISO). */
export type Notice = { from: 'tenant' | 'landlord'; date: string; exitDate: string; reason?: string };

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
  /** Loyer du mois (révisions comprises) */
  rent: number;
  /** Reste dû sur les mois antérieurs au mois affiché */
  arrears: number;
};

export type ExpenseCategory = 'works' | 'maintenance' | 'utilities' | 'taxes' | 'insurance' | 'caretaker' | 'agency_fees' | 'other';

export type ExpenseMethod = 'cash' | 'mobile_money' | 'bank' | 'cheque';

/** Dépense d'un bien (et si besoin d'une unité). */
export type Expense = {
  id: string;
  propertyId: string;
  unitId?: string;
  category: ExpenseCategory;
  amount: number;
  /** Date de la dépense, ISO (midi local) */
  date: string;
  method: ExpenseMethod;
  supplier?: string;
  note?: string;
  /** Dépense mensuelle qui l'a créée */
  scheduleId?: string;
  /** Photo du justificatif : lien signé du serveur ou data URI pas encore envoyée */
  receipt?: string;
};

/** Dépense qui revient chaque mois, le même jour (gardien, abonnement). */
export type ExpenseSchedule = {
  id: string;
  propertyId: string;
  unitId?: string;
  category: ExpenseCategory;
  amount: number;
  method: ExpenseMethod;
  supplier?: string;
  note?: string;
  dayOfMonth: number;
  /** Premier mois, "YYYY-MM" */
  startPeriod: string;
};

/** Opérateur où le locataire peut payer directement le bailleur */
export type PayoutMethod = 'wave' | 'orange' | 'mtn' | 'moov';

/** Numéro où les locataires paient directement (affiché dans leur espace) */
export type PayoutAccount = { method: PayoutMethod; number: string; name?: string };

/** Paiement signalé par un locataire depuis son espace (« J'ai payé »), à confirmer ou refuser */
export type PaymentDeclaration = {
  id: string;
  tenantId: string;
  amount: number;
  method: PaymentMethod;
  /** Jour du paiement indiqué par le locataire (ISO, midi) */
  paidOn: string;
  reference?: string;
  note?: string;
  /** Capture d'écran envoyée par le locataire (lien signé) */
  proofUrl?: string;
  createdAt: string;
};
