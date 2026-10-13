import { api } from '@/lib/api';
import { periodOf } from '@/lib/format';

import type { ProrataRule } from './prorata';
import type { Payment, PaymentMethod, Property, PropertyType, Settlement, Tenant, Unit } from './types';

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

export type ApiOrganization = {
  id: string;
  name: string;
  countryCode: string;
  currency: string;
  timeZone: string;
  prorataRule: ProrataRule;
  role: 'owner' | 'manager' | 'collector' | 'viewer';
};

type ApiPayment = {
  id: string;
  leaseId: string;
  amount: number;
  method: PaymentMethod;
  period: string;
  receivedAt: string;
};

type ApiLease = {
  id: string;
  unitId: string;
  tenant: { id: string; firstName: string; lastName: string; phone: string };
  rent: number;
  dueDay: number;
  entryDate: string;
  exitDate: string | null;
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
  properties: {
    id: string;
    name: string;
    type: PropertyType;
    district: string;
    city: string;
    description: string | null;
    units: { id: string; label: string; rent: number }[];
  }[];
  leases: ApiLease[];
  payments: ApiPayment[];
};

export type RemoteData = {
  organization: ApiOrganization;
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  payments: Payment[];
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
});

export function fromSnapshot(s: ApiSnapshot, today: Date): RemoteData {
  const current = periodOf(today);
  const active = new Map(s.leases.filter((l) => !l.exitDate).map((l) => [l.unitId, l]));
  const payments = s.payments.map(toPayment);

  return {
    organization: s.organization,
    properties: s.properties.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      district: p.district,
      city: p.city,
      description: p.description ?? undefined,
    })),
    // Le loyer affiché d'une unité louée est celui du bail en cours (comme en mode local)
    units: s.properties.flatMap((p) =>
      p.units.map((u) => ({ id: u.id, propertyId: p.id, label: u.label, rent: active.get(u.id)?.rent ?? u.rent })),
    ),
    tenants: s.leases.map((l) => ({
      id: l.id,
      firstName: l.tenant.firstName,
      lastName: l.tenant.lastName,
      phone: l.tenant.phone,
      unitId: l.unitId,
      dueDay: l.dueDay,
      depositMonths: l.depositMonths,
      entryDate: localNoon(l.entryDate),
      exitDate: l.exitDate ? localNoon(l.exitDate) : undefined,
      settlement: l.settlement ? toSettlement(l.settlement) : undefined,
      advanceMonthsLeft: new Set(payments.filter((p) => p.tenantId === l.id && p.period > current).map((p) => p.period)).size,
    })),
    payments,
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
  depositMonths: number;
  advance?: { months: number; method: PaymentMethod };
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

export const remote = {
  me: () => api.get<{ user: ApiUser; organizations: ApiOrganization[] }>('/user/me'),

  updateProfile: (firstName: string, lastName: string) => api.patch<ApiUser>('/user/me', { firstName, lastName }),

  createOrganization: (body: { id: string; name: string; countryCode: string }) =>
    api.post<ApiOrganization>('/user/organizations', body),

  updateOrganization: (orgId: string, body: { prorataRule?: ProrataRule; name?: string }) =>
    api.patch<ApiOrganization>(`/user/organizations/${orgId}`, body),

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

  voidPayment: (orgId: string, paymentId: string, reason: string) =>
    api.post<ApiPayment>(`/user/organizations/${orgId}/payments/${paymentId}/void`, { reason }),

  logout: () => api.post<void>('/user/auth/logout', {}),
};

export { toPayment };
