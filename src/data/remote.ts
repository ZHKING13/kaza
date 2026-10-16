import { api } from '@/lib/api';
import { imageForm } from '@/lib/images';
import { periodOf } from '@/lib/format';

import type { BillingMonths, OrganizationSubscription, PlanId, PlanLimits, SubscriptionStatus } from './plans';
import type { ProrataRule } from './prorata';
import { type LeaseSettings, type NoticeFrom, rentAt, tenantRent } from './rent';
import type {
  Expense,
  ExpenseCategory,
  ExpenseMethod,
  ExpenseSchedule,
  Payment,
  PaymentMethod,
  Property,
  PropertyType,
  Settlement,
  Tenant,
  Unit,
} from './types';

/**
 * Données du serveur et conversion vers le modèle de l'application.
 * Côté application, un « locataire » est un bail : son identifiant est celui du bail, et les
 * paiements pointent vers lui (`tenantId`).
 */

export type ApiUser = {
  id: string;
  phone: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

/** Messages envoyés aux locataires par le serveur (WhatsApp, repli SMS). */
export type MessagingSettings = {
  /** Relances automatiques du loyer */
  remindersEnabled: boolean;
  /** Rappel N jours avant l'échéance (0 : aucun) */
  reminderDaysBefore: number;
  /** Après l'échéance, relance tous les N jours (0 : une seule) */
  reminderLateRepeatDays: number;
  reminderLateMax: number;
  /** Quittance après chaque encaissement, bienvenue, solde de départ */
  autoMessagesEnabled: boolean;
};

export type Role = 'owner' | 'manager' | 'collector' | 'viewer';

export type ApiOrganization = {
  id: string;
  name: string;
  type?: 'individual' | 'agency';
  countryCode: string;
  currency: string;
  timeZone: string;
  prorataRule: ProrataRule;
  messaging?: MessagingSettings;
  /** Préavis par défaut et seuils des alertes de fin de bail et de révision */
  leases?: LeaseSettings;
  /** Liens de paiement mobile money disponibles (agrégateur configuré sur le serveur) */
  onlinePaymentsEnabled?: boolean;
  /** Offre en vigueur (essai, payée, grâce, mode limité) */
  subscription?: OrganizationSubscription;
  role: Role;
};

/** Identité imprimée sur les quittances (toutes facultatives) */
export type IdentityFields = {
  legalName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  registrationNumber: string | null;
  taxId: string | null;
  /** Clé de la palette (`brandColors`) */
  brandColor: string;
  receiptFooter: string | null;
};

/** Identité telle que le serveur la renvoie : liens signés vers le logo et le cachet (temporaires) */
export type ApiIdentity = IdentityFields & { logoUrl: string | null; stampUrl: string | null };

/** `property` : photo du bien ; `expense` : justificatif d'une dépense (`propertyId` porte alors l'id de la dépense) */
export type ImageTarget = 'logo' | 'stamp' | 'property' | 'expense';

/** Facture d'abonnement */
export type SubscriptionInvoice = {
  id: string;
  plan: PlanId;
  months: number;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'expired';
  number: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  createdAt: string;
};

/** Offre de l'espace : en vigueur, usage, catalogue, factures payées */
export type SubscriptionDetail = {
  plan: PlanId;
  status: SubscriptionStatus;
  effectivePlan: PlanId;
  endsAt: string | null;
  daysLeft: number | null;
  trialEndsAt: string | null;
  paidUntil: string | null;
  limits: PlanLimits;
  usage: { units: number; members: number; messagesThisMonth: number };
  billingAvailable: boolean;
  catalog: { id: PlanId; label: string; monthlyPrice: number; prices: { months: number; amount: number }[]; limits: PlanLimits }[];
  invoices: SubscriptionInvoice[];
};

/** Membre d'un espace */
export type TeamMember = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: Role;
  joinedAt: string;
  isMe: boolean;
};

/** Invitation en attente, vue par l'espace */
export type TeamInvitation = {
  id: string;
  phone: string;
  role: Role;
  expiresAt: string;
  createdAt: string;
  invitedBy: { id: string; name: string } | null;
};

/** Invitation reçue sur le numéro de l'utilisateur */
export type ReceivedInvitation = {
  id: string;
  role: Role;
  expiresAt: string;
  organization: { id: string; name: string; type: 'individual' | 'agency' };
  invitedBy: { id: string; name: string } | null;
};

/** Lien de paiement mobile money envoyé au locataire */
export type PaymentRequest = {
  id: string;
  leaseId: string;
  period: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled';
  link: string;
  paymentId: string | null;
  expiresAt: string;
  paidAt: string | null;
  createdAt: string;
};

/** Ligne du journal d'activité */
export type ActivityEntry = {
  id: string;
  action: string;
  actor: { id: string; name: string; role: Role | null } | null;
  entityType: string;
  entityId: string;
  subject: string | null;
  data: Record<string, unknown> | null;
  createdAt: string;
};

export type TenantMessageKind =
  | 'rent_due_soon'
  | 'rent_late'
  | 'rent_manual'
  | 'receipt'
  | 'welcome'
  | 'settlement'
  | 'payment_link'
  | 'rent_revision';
export type TenantMessageStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'cancelled';

/** Message envoyé à un locataire par Kaza */
export type TenantMessage = {
  id: string;
  leaseId: string;
  paymentId: string | null;
  kind: TenantMessageKind;
  period: string | null;
  channel: 'whatsapp' | 'sms' | null;
  status: TenantMessageStatus;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
};

type ApiPayment = {
  id: string;
  leaseId: string;
  amount: number;
  method: PaymentMethod;
  period: string;
  receivedAt: string;
  source?: 'manual' | 'mobile_money' | 'settlement';
};

type ApiLease = {
  id: string;
  unitId: string;
  tenant: { id: string; firstName: string; lastName: string; phone: string };
  /** Loyer à l'entrée ; les révisions sont dans `rents` */
  rent: number;
  rents?: { id: string; from: string; amount: number; reason: string | null }[];
  dueDay: number;
  entryDate: string;
  exitDate: string | null;
  endDate?: string | null;
  notice?: { from: NoticeFrom; date: string; exitDate: string; reason: string | null } | null;
  depositMonths: number;
  advanceMonths: number;
  settlement: ApiSettlement | null;
};

type ApiSettlement = {
  id: string;
  deposit: number;
  prepaid: number;
  arrearsDeducted: number;
  arrearsLeft: number;
  deductions: { label: string; amount: number }[];
  balance: number;
  refundMethod: PaymentMethod | null;
};

export const toSettlement = (s: ApiSettlement): Settlement => ({
  deposit: s.deposit,
  prepaid: s.prepaid,
  arrearsDeducted: s.arrearsDeducted,
  arrearsLeft: s.arrearsLeft,
  deductions: s.deductions,
  balance: s.balance,
  refundMethod: s.refundMethod ?? undefined,
});

type ApiSnapshot = {
  organization: ApiOrganization;
  identity?: ApiIdentity;
  properties: {
    id: string;
    name: string;
    type: PropertyType;
    district: string;
    city: string;
    description: string | null;
    photoUrl?: string | null;
    landlordName?: string | null;
    landlordPhone?: string | null;
    commissionBps?: number | null;
    units: { id: string; label: string; rent: number }[];
  }[];
  leases: ApiLease[];
  payments: ApiPayment[];
  expenses?: ApiExpense[];
  expenseSchedules?: ApiExpenseSchedule[];
};

export type ApiExpense = {
  id: string;
  propertyId: string;
  unitId: string | null;
  category: ExpenseCategory;
  amount: number;
  date: string;
  method: ExpenseMethod;
  supplier: string | null;
  note: string | null;
  scheduleId: string | null;
  receiptUrl: string | null;
};

export type ApiExpenseSchedule = {
  id: string;
  propertyId: string;
  unitId: string | null;
  category: ExpenseCategory;
  amount: number;
  method: ExpenseMethod;
  supplier: string | null;
  note: string | null;
  dayOfMonth: number;
  startPeriod: string;
};

export const toExpense = (e: ApiExpense): Expense => ({
  id: e.id,
  propertyId: e.propertyId,
  unitId: e.unitId ?? undefined,
  category: e.category,
  amount: e.amount,
  date: localNoon(e.date),
  method: e.method,
  supplier: e.supplier ?? undefined,
  note: e.note ?? undefined,
  scheduleId: e.scheduleId ?? undefined,
  receipt: e.receiptUrl ?? undefined,
});

export const toExpenseSchedule = (e: ApiExpenseSchedule): ExpenseSchedule => ({
  id: e.id,
  propertyId: e.propertyId,
  unitId: e.unitId ?? undefined,
  category: e.category,
  amount: e.amount,
  method: e.method,
  supplier: e.supplier ?? undefined,
  note: e.note ?? undefined,
  dayOfMonth: e.dayOfMonth,
  startPeriod: e.startPeriod,
});

export type RemoteData = {
  organization: ApiOrganization;
  identity: ApiIdentity | null;
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  payments: Payment[];
  expenses: Expense[];
  expenseSchedules: ExpenseSchedule[];
};

/** Les dates calendaires du serveur sont lues à midi heure locale (même jour partout). */
const localNoon = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toISOString();
};

const toPayment = (p: ApiPayment): Payment => ({
  id: p.id,
  tenantId: p.leaseId,
  amount: p.amount,
  method: p.method,
  date: p.receivedAt,
  period: p.period,
  ...(p.source === 'mobile_money' ? { online: true } : {}),
});

export function fromSnapshot(s: ApiSnapshot, today: Date): RemoteData {
  const current = periodOf(today);
  const payments = s.payments.map(toPayment);
  const tenants: Tenant[] = s.leases.map((l) => ({
    id: l.id,
    firstName: l.tenant.firstName,
    lastName: l.tenant.lastName,
    phone: l.tenant.phone,
    unitId: l.unitId,
    dueDay: l.dueDay,
    depositMonths: l.depositMonths,
    entryDate: localNoon(l.entryDate),
    exitDate: l.exitDate ? localNoon(l.exitDate) : undefined,
    rent: l.rent,
    rents: (l.rents ?? []).map((r) => ({ id: r.id, from: r.from, amount: r.amount, reason: r.reason ?? undefined })),
    endDate: l.endDate ? localNoon(l.endDate) : undefined,
    notice: l.notice
      ? {
          from: l.notice.from,
          date: localNoon(l.notice.date),
          exitDate: localNoon(l.notice.exitDate),
          reason: l.notice.reason ?? undefined,
        }
      : undefined,
    settlement: l.settlement ? toSettlement(l.settlement) : undefined,
    advanceMonthsLeft: new Set(payments.filter((p) => p.tenantId === l.id && p.period > current).map((p) => p.period)).size,
  }));
  // Loyer du mois en cours des baux actifs, par unité
  const active = new Map(
    tenants.filter((t) => !t.exitDate).map((t) => [t.unitId, rentAt(tenantRent(t, { rent: t.rent ?? 0 }), current)]),
  );

  return {
    organization: s.organization,
    identity: s.identity ?? null,
    properties: s.properties.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      district: p.district,
      city: p.city,
      description: p.description ?? undefined,
      photo: p.photoUrl ?? undefined,
      landlordName: p.landlordName ?? undefined,
      landlordPhone: p.landlordPhone ?? undefined,
      commissionBps: p.commissionBps ?? undefined,
    })),
    // Le loyer affiché d'une unité louée est celui du bail en cours ce mois-ci (comme en mode local)
    units: s.properties.flatMap((p) =>
      p.units.map((u) => ({ id: u.id, propertyId: p.id, label: u.label, rent: active.get(u.id) ?? u.rent })),
    ),
    tenants,
    payments,
    expenses: (s.expenses ?? []).map(toExpense),
    expenseSchedules: (s.expenseSchedules ?? []).map(toExpenseSchedule),
  };
}

export type UnitBody = { id: string; label: string; rent: number };

export type PropertyBody = {
  id: string;
  name: string;
  type: PropertyType;
  district: string;
  city: string;
  description?: string;
  units: UnitBody[];
};

export type LeaseBody = {
  id: string;
  unitId: string;
  tenant: { firstName: string; lastName: string; phone: string };
  rent: number;
  dueDay: number;
  /** "YYYY-MM-DD" */
  entryDate: string;
  /** "YYYY-MM-DD", facultative */
  endDate?: string;
  depositMonths: number;
  advance?: { months: number; method: PaymentMethod };
};

export type RentRevisionBody = {
  id: string;
  amount: number;
  /** "YYYY-MM" */
  from: string;
  reason?: string;
  notifyTenant: boolean;
  applyToUnit: boolean;
};

export type NoticeBody = {
  from: NoticeFrom;
  /** "YYYY-MM-DD" */
  date: string;
  exitDate?: string;
  reason?: string;
};

export type DepartureBody = {
  /** Identifiant du solde, choisi par le téléphone */
  id: string;
  /** "YYYY-MM-DD" */
  exitDate: string;
  deductArrears: boolean;
  deductions: { label: string; amount: number }[];
  refundMethod?: PaymentMethod;
};

export type ExpenseBody = {
  id: string;
  propertyId: string;
  unitId?: string;
  category: ExpenseCategory;
  amount: number;
  /** "YYYY-MM-DD" */
  date: string;
  method: ExpenseMethod;
  supplier?: string;
  note?: string;
  repeatMonthly?: boolean;
};

export type ExpenseUpdateBody = Partial<{
  unitId: string | null;
  category: ExpenseCategory;
  amount: number;
  date: string;
  method: ExpenseMethod;
  supplier: string | null;
  note: string | null;
}>;

export type LandlordBody = { landlordName: string | null; landlordPhone: string | null; commissionBps: number | null };

/** Encaissement réparti sur plusieurs mois (identifiants des paiements choisis par le téléphone, dans l'ordre des mois) */
export type AllocationBody = {
  ids: string[];
  leaseId: string;
  amount: number;
  method: PaymentMethod;
  startPeriod?: string;
  receivedAt: string;
};

export type PaymentBody = {
  id: string;
  leaseId: string;
  amount: number;
  method: PaymentMethod;
  period: string;
  receivedAt: string;
};

/** Date calendaire "YYYY-MM-DD" (heure locale) d'une date ISO de l'application. */
export const calendarDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function imagePath(orgId: string, target: ImageTarget, id?: string): string {
  if (target === 'property') return `/user/organizations/${orgId}/properties/${id}/photo`;
  if (target === 'expense') return `/user/organizations/${orgId}/expenses/${id}/receipt`;
  return `/user/organizations/${orgId}/identity/${target}`;
}

export const remote = {
  me: () => api.get<{ user: ApiUser; organizations: ApiOrganization[] }>('/user/me'),

  updateProfile: (firstName: string, lastName: string) => api.patch<ApiUser>('/user/me', { firstName, lastName }),

  createOrganization: (body: { id: string; name: string; countryCode: string }) =>
    api.post<ApiOrganization>('/user/organizations', body),

  updateOrganization: (
    orgId: string,
    body: { prorataRule?: ProrataRule; name?: string; messaging?: Partial<MessagingSettings>; leases?: Partial<LeaseSettings> },
  ) => api.patch<ApiOrganization>(`/user/organizations/${orgId}`, body),

  subscription: (orgId: string) => api.get<SubscriptionDetail>(`/user/organizations/${orgId}/subscription`),

  subscriptionCheckout: (orgId: string, plan: PlanId, months: BillingMonths) =>
    api.post<{ invoice: SubscriptionInvoice; checkoutUrl: string }>(`/user/organizations/${orgId}/subscription/checkout`, {
      plan,
      months,
    }),

  identity: (orgId: string) => api.get<ApiIdentity>(`/user/organizations/${orgId}/identity`),

  updateIdentity: (orgId: string, body: Partial<IdentityFields>) =>
    api.patch<ApiIdentity>(`/user/organizations/${orgId}/identity`, body),

  /** Logo, cachet ou photo d'un bien ; `uri` : data URI ou fichier local */
  putImage: async (orgId: string, target: ImageTarget, uri: string, propertyId?: string) =>
    api.upload<ApiIdentity | { photoUrl: string | null }>(
      'PUT',
      imagePath(orgId, target, propertyId),
      await imageForm(uri, target),
    ),

  deleteImage: (orgId: string, target: ImageTarget, propertyId?: string) =>
    api.delete<ApiIdentity | { photoUrl: string | null }>(imagePath(orgId, target, propertyId)),

  createExpense: (orgId: string, body: ExpenseBody) =>
    api.post<{ expense: ApiExpense; schedule: ApiExpenseSchedule | null }>(`/user/organizations/${orgId}/expenses`, body),

  updateExpense: (orgId: string, expenseId: string, body: ExpenseUpdateBody) =>
    api.patch<ApiExpense>(`/user/organizations/${orgId}/expenses/${expenseId}`, body),

  voidExpense: (orgId: string, expenseId: string, reason: string) =>
    api.post<ApiExpense>(`/user/organizations/${orgId}/expenses/${expenseId}/void`, { reason }),

  stopExpenseSchedule: (orgId: string, scheduleId: string) =>
    api.post<ApiExpenseSchedule>(`/user/organizations/${orgId}/expense-schedules/${scheduleId}/stop`, {}),

  updateLandlord: (orgId: string, propertyId: string, body: LandlordBody) =>
    api.patch<unknown>(`/user/organizations/${orgId}/properties/${propertyId}`, body),

  members: (orgId: string) => api.get<TeamMember[]>(`/user/organizations/${orgId}/members`),

  changeRole: (orgId: string, userId: string, role: Role) =>
    api.patch<TeamMember[]>(`/user/organizations/${orgId}/members/${userId}`, { role }),

  removeMember: (orgId: string, userId: string) => api.delete<void>(`/user/organizations/${orgId}/members/${userId}`),

  invitations: (orgId: string) => api.get<TeamInvitation[]>(`/user/organizations/${orgId}/invitations`),

  invite: (orgId: string, phone: string, role: Role) =>
    api.post<TeamInvitation>(`/user/organizations/${orgId}/invitations`, { phone, role }),

  revokeInvitation: (orgId: string, invitationId: string) =>
    api.delete<void>(`/user/organizations/${orgId}/invitations/${invitationId}`),

  receivedInvitations: () => api.get<ReceivedInvitation[]>('/user/invitations'),

  acceptInvitation: (invitationId: string) => api.post<ApiOrganization>(`/user/invitations/${invitationId}/accept`, {}),

  declineInvitation: (invitationId: string) => api.post<void>(`/user/invitations/${invitationId}/decline`, {}),

  activity: (orgId: string, cursor?: string) =>
    api.get<{ items: ActivityEntry[]; nextCursor: string | null }>(
      `/user/organizations/${orgId}/activity${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
    ),

  createPaymentRequest: (orgId: string, leaseId: string, body: { period?: string; amount?: number; send?: boolean }) =>
    api.post<PaymentRequest>(`/user/organizations/${orgId}/leases/${leaseId}/payment-requests`, body),

  paymentRequests: (orgId: string, leaseId: string) =>
    api.get<PaymentRequest[]>(`/user/organizations/${orgId}/leases/${leaseId}/payment-requests`),

  cancelPaymentRequest: (orgId: string, id: string) =>
    api.post<PaymentRequest>(`/user/organizations/${orgId}/payment-requests/${id}/cancel`, {}),

  messages: (orgId: string, leaseId: string) =>
    api.get<TenantMessage[]>(`/user/organizations/${orgId}/leases/${leaseId}/messages`),

  sendRentReminder: (orgId: string, leaseId: string) =>
    api.post<TenantMessage>(`/user/organizations/${orgId}/leases/${leaseId}/messages/rent-reminder`, {}),

  sendReceipt: (orgId: string, paymentId: string) =>
    api.post<TenantMessage>(`/user/organizations/${orgId}/payments/${paymentId}/messages/receipt`, {}),

  snapshot: async (orgId: string, today: Date) =>
    fromSnapshot(await api.get<ApiSnapshot>(`/user/organizations/${orgId}/snapshot`), today),

  createProperty: (orgId: string, body: PropertyBody) =>
    api.post<{ id: string; units: { id: string; label: string; rent: number }[] }>(`/user/organizations/${orgId}/properties`, body),

  addUnits: (orgId: string, propertyId: string, units: UnitBody[]) =>
    api.post<{ id: string; label: string; rent: number }[]>(`/user/organizations/${orgId}/properties/${propertyId}/units`, { units }),

  createLease: (orgId: string, body: LeaseBody, idempotencyKey: string) =>
    api
      .post<{ lease: { id: string }; payments: ApiPayment[] }>(`/user/organizations/${orgId}/leases`, body, { idempotencyKey })
      .then((res) => ({ leaseId: res.lease.id, payments: res.payments.map(toPayment) })),

  allocatePayment: (orgId: string, body: AllocationBody, idempotencyKey: string) =>
    api
      .post<{ payments: ApiPayment[] }>(`/user/organizations/${orgId}/payments/allocations`, body, { idempotencyKey })
      .then((res) => res.payments.map(toPayment)),

  createPayment: (orgId: string, body: PaymentBody, idempotencyKey: string) =>
    api.post<ApiPayment>(`/user/organizations/${orgId}/payments`, body, { idempotencyKey }).then(toPayment),

  departure: (orgId: string, leaseId: string, body: DepartureBody) =>
    api
      .post<{ settlement: ApiSettlement; payments: ApiPayment[]; voidedPaymentIds: string[] }>(
        `/user/organizations/${orgId}/leases/${leaseId}/departure`,
        body,
      )
      .then((res) => ({
        settlement: toSettlement(res.settlement),
        payments: res.payments.map(toPayment),
        voidedPaymentIds: res.voidedPaymentIds,
      })),

  reviseRent: (orgId: string, leaseId: string, body: RentRevisionBody) =>
    api.post<unknown>(`/user/organizations/${orgId}/leases/${leaseId}/rent-revisions`, body),

  cancelRentRevision: (orgId: string, leaseId: string, revisionId: string) =>
    api.post<unknown>(`/user/organizations/${orgId}/leases/${leaseId}/rent-revisions/${revisionId}/cancel`, {}),

  setEndDate: (orgId: string, leaseId: string, endDate: string | null) =>
    api.put<unknown>(`/user/organizations/${orgId}/leases/${leaseId}/end-date`, { endDate }),

  giveNotice: (orgId: string, leaseId: string, body: NoticeBody) =>
    api.post<unknown>(`/user/organizations/${orgId}/leases/${leaseId}/notice`, body),

  withdrawNotice: (orgId: string, leaseId: string) =>
    api.post<unknown>(`/user/organizations/${orgId}/leases/${leaseId}/notice/cancel`, {}),

  voidPayment: (orgId: string, paymentId: string, reason: string) =>
    api.post<ApiPayment>(`/user/organizations/${orgId}/payments/${paymentId}/void`, { reason }),

  logout: () => api.post<void>('/user/auth/logout', {}),
};

export { toPayment };
