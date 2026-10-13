import { api, newIdempotencyKey } from '@/lib/api';
import { periodOf } from '@/lib/format';

import type { ProrataRule } from './prorata';
import type { Payment, PaymentMethod, Property, PropertyType, Tenant, Unit } from './types';

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
};

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
      advanceMonthsLeft: new Set(payments.filter((p) => p.tenantId === l.id && p.period > current).map((p) => p.period)).size,
    })),
    payments,
  };
}

/** Date calendaire "YYYY-MM-DD" (heure locale) d'une date ISO de l'application. */
const calendarDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const remote = {
  me: () => api.get<{ user: ApiUser; organizations: ApiOrganization[] }>('/user/me'),

  updateProfile: (firstName: string, lastName: string) => api.patch<ApiUser>('/user/me', { firstName, lastName }),

  createOrganization: (name: string, countryCode: string) =>
    api.post<ApiOrganization>('/user/organizations', { name, countryCode }),

  updateOrganization: (orgId: string, body: { prorataRule?: ProrataRule; name?: string }) =>
    api.patch<ApiOrganization>(`/user/organizations/${orgId}`, body),

  snapshot: async (orgId: string, today: Date) =>
    fromSnapshot(await api.get<ApiSnapshot>(`/user/organizations/${orgId}/snapshot`), today),

  createProperty: (orgId: string, property: Omit<Property, 'id' | 'photo'>, units: { label: string; rent: number }[]) =>
    api.post<{ id: string; units: { id: string; label: string; rent: number }[] }>(`/user/organizations/${orgId}/properties`, {
      name: property.name,
      type: property.type,
      district: property.district,
      city: property.city,
      description: property.description,
      units,
    }),

  addUnits: (orgId: string, propertyId: string, units: { label: string; rent: number }[]) =>
    api.post<{ id: string; label: string; rent: number }[]>(`/user/organizations/${orgId}/properties/${propertyId}/units`, { units }),

  createLease: (
    orgId: string,
    input: {
      unitId: string;
      tenant: { firstName: string; lastName: string; phone: string };
      rent: number;
      dueDay: number;
      entryDate?: string;
      depositMonths: number;
      advance?: { months: number; method: PaymentMethod };
    },
    idempotencyKey = newIdempotencyKey(),
  ) =>
    api.post<{ lease: { id: string }; payments: ApiPayment[] }>(
      `/user/organizations/${orgId}/leases`,
      {
        ...input,
        entryDate: calendarDate(input.entryDate ?? new Date().toISOString()),
      },
      { idempotencyKey },
    ),

  createPayment: (
    orgId: string,
    input: { leaseId: string; amount: number; method: PaymentMethod; period: string; receivedAt: string },
    idempotencyKey = newIdempotencyKey(),
  ) => api.post<ApiPayment>(`/user/organizations/${orgId}/payments`, input, { idempotencyKey }).then(toPayment),

  logout: () => api.post<void>('/user/auth/logout', {}),
};

export { toPayment };
