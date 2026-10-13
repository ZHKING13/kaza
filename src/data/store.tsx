import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';

import { periodOf } from '@/lib/format';

import { buildPayments, lots, properties, tenants } from './mock';
import type { Lot, Payment, Property, Tenant, TenantSummary } from './types';

type State = {
  properties: Property[];
  lots: Lot[];
  tenants: Tenant[];
  payments: Payment[];
};

type Action = { type: 'addPayment'; payment: Omit<Payment, 'id'> };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'addPayment':
      return {
        ...state,
        payments: [{ ...action.payment, id: `pay-${Date.now()}` }, ...state.payments],
      };
  }
}

type Store = State & {
  today: Date;
  period: string;
  addPayment: (payment: Omit<Payment, 'id'>) => void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const today = useMemo(() => new Date(), []);
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    properties,
    lots,
    tenants,
    payments: buildPayments(today),
  }));
  const value = useMemo<Store>(
    () => ({
      ...state,
      today,
      period: periodOf(today),
      addPayment: (payment) => dispatch({ type: 'addPayment', payment }),
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
  const { tenants, lots, properties, payments, today, period } = useStore();
  return useMemo(
    () =>
      tenants.map((tenant) => {
        const lot = lots.find((l) => l.id === tenant.lotId)!;
        const property = properties.find((p) => p.id === lot.propertyId)!;
        const paid = payments
          .filter((p) => p.tenantId === tenant.id && p.period === period)
          .reduce((sum, p) => sum + p.amount, 0);
        const dueDate = new Date(today.getFullYear(), today.getMonth(), tenant.dueDay);
        const status: TenantSummary['status'] =
          paid >= lot.rent ? 'paid' : paid > 0 ? 'partial' : today > dueDate ? 'late' : 'upcoming';
        return { tenant, lot, property, status, paid, due: lot.rent, dueDate: dueDate.toISOString() };
      }),
    [tenants, lots, properties, payments, today, period],
  );
}

export function useMonthTotals() {
  const summaries = useTenantSummaries();
  const { lots } = useStore();
  return useMemo(() => {
    const expected = summaries.reduce((s, x) => s + x.due, 0);
    const collected = summaries.reduce((s, x) => s + Math.min(x.paid, x.due), 0);
    const late = summaries.filter((x) => x.status === 'late' || x.status === 'partial');
    const occupied = new Set(summaries.map((x) => x.lot.id));
    return {
      expected,
      collected,
      outstanding: expected - collected,
      lateCount: late.length,
      paidCount: summaries.filter((x) => x.status === 'paid').length,
      tenantCount: summaries.length,
      vacantCount: lots.filter((l) => !occupied.has(l.id)).length,
    };
  }, [summaries, lots]);
}
