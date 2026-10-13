import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';

import { periodOf } from '@/lib/format';

import { buildPayments, units, properties, tenants } from './mock';
import type { Unit, Payment, Property, Tenant, TenantSummary } from './types';

type State = {
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  payments: Payment[];
};

type Action =
  | { type: 'addPayment'; payment: Omit<Payment, 'id'> }
  | { type: 'addProperty'; property: Property; units: Unit[] }
  | { type: 'addUnits'; units: Unit[] };

export type NewUnit = Pick<Unit, 'label' | 'rent'>;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'addPayment':
      return {
        ...state,
        payments: [{ ...action.payment, id: `pay-${Date.now()}` }, ...state.payments],
      };
    case 'addProperty':
      return { ...state, properties: [action.property, ...state.properties], units: [...state.units, ...action.units] };
    case 'addUnits':
      return { ...state, units: [...state.units, ...action.units] };
  }
}

type Store = State & {
  today: Date;
  period: string;
  addPayment: (payment: Omit<Payment, 'id'>) => void;
  /** Crée le bien et ses unités, renvoie l'identifiant du bien */
  addProperty: (property: Omit<Property, 'id'>, units: NewUnit[]) => string;
  addUnits: (propertyId: string, units: NewUnit[]) => void;
};

let seq = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;
const toUnits = (propertyId: string, units: NewUnit[]): Unit[] =>
  units.map((u) => ({ id: newId('u'), propertyId, label: u.label.trim(), rent: u.rent }));

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const today = useMemo(() => new Date(), []);
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    properties,
    units,
    tenants,
    payments: buildPayments(today),
  }));
  const value = useMemo<Store>(
    () => ({
      ...state,
      today,
      period: periodOf(today),
      addPayment: (payment) => dispatch({ type: 'addPayment', payment }),
      addProperty: (property, units) => {
        const id = newId('p');
        dispatch({ type: 'addProperty', property: { ...property, id }, units: toUnits(id, units) });
        return id;
      },
      addUnits: (propertyId, units) => dispatch({ type: 'addUnits', units: toUnits(propertyId, units) }),
    }),
    [state, today],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}

/** Situation de chaque locataire pour le mois en cours. */
export function useTenantSummaries(): TenantSummary[] {
  const { tenants, units, properties, payments, today, period } = useStore();
  return useMemo(
    () =>
      tenants.map((tenant) => {
        const unit = units.find((l) => l.id === tenant.unitId)!;
        const property = properties.find((p) => p.id === unit.propertyId)!;
        const paid = payments
          .filter((p) => p.tenantId === tenant.id && p.period === period)
          .reduce((sum, p) => sum + p.amount, 0);
        const dueDate = new Date(today.getFullYear(), today.getMonth(), tenant.dueDay);
        const status: TenantSummary['status'] =
          paid >= unit.rent ? 'paid' : paid > 0 ? 'partial' : today > dueDate ? 'late' : 'upcoming';
        return { tenant, unit, property, status, paid, due: unit.rent, dueDate: dueDate.toISOString() };
      }),
    [tenants, units, properties, payments, today, period],
  );
}

export function useMonthTotals() {
  const summaries = useTenantSummaries();
  const { units } = useStore();
  return useMemo(() => {
    const expected = summaries.reduce((s, x) => s + x.due, 0);
    const collected = summaries.reduce((s, x) => s + Math.min(x.paid, x.due), 0);
    const late = summaries.filter((x) => x.status === 'late' || x.status === 'partial');
    const occupied = new Set(summaries.map((x) => x.unit.id));
    return {
      expected,
      collected,
      outstanding: expected - collected,
      lateCount: late.length,
      paidCount: summaries.filter((x) => x.status === 'paid').length,
      tenantCount: summaries.length,
      vacantCount: units.filter((l) => !occupied.has(l.id)).length,
    };
  }, [summaries, units]);
}

export type PropertySummary = {
  property: Property;
  units: Unit[];
  tenants: TenantSummary[];
  expected: number;
  collected: number;
  lateCount: number;
  vacantCount: number;
  occupancy: number;
};

/** Situation de chaque bien pour le mois en cours. */
export function usePropertySummaries(): PropertySummary[] {
  const { properties, units } = useStore();
  const summaries = useTenantSummaries();
  return useMemo(
    () =>
      properties.map((property) => {
        const pUnits = units.filter((u) => u.propertyId === property.id);
        const pTenants = summaries.filter((s) => s.property.id === property.id);
        const occupied = new Set(pTenants.map((s) => s.unit.id));
        return {
          property,
          units: pUnits,
          tenants: pTenants,
          expected: pTenants.reduce((s, x) => s + x.due, 0),
          collected: pTenants.reduce((s, x) => s + Math.min(x.paid, x.due), 0),
          lateCount: pTenants.filter((x) => x.status === 'late' || x.status === 'partial').length,
          vacantCount: pUnits.filter((u) => !occupied.has(u.id)).length,
          occupancy: pUnits.length ? occupied.size / pUnits.length : 0,
        };
      }),
    [properties, units, summaries],
  );
}
