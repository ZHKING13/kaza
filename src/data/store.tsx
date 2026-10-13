import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';

import { periodOf } from '@/lib/format';

import { buildPayments, units, properties, tenants } from './mock';
import { computeSettlement } from './ledger';
import type { Payment, PaymentMethod, Property, Settlement, Tenant, TenantSummary, Unit } from './types';

type State = {
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  payments: Payment[];
};

type Action =
  | { type: 'addPayment'; payment: Omit<Payment, 'id'> }
  | { type: 'addProperty'; property: Property; units: Unit[] }
  | { type: 'addUnits'; units: Unit[] }
  | { type: 'addTenant'; tenant: Tenant; rent: number; payments: Payment[] }
  | { type: 'recordDeparture'; tenantId: string; exitDate: string; settlement: Settlement; addPayments: Payment[]; removePaymentIds: string[] };

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
    case 'addTenant':
      return {
        ...state,
        tenants: [...state.tenants, action.tenant],
        units: state.units.map((u) => (u.id === action.tenant.unitId ? { ...u, rent: action.rent } : u)),
        payments: [...action.payments, ...state.payments],
      };
    case 'recordDeparture': {
      const removed = new Set(action.removePaymentIds);
      return {
        ...state,
        tenants: state.tenants.map((t) =>
          t.id === action.tenantId ? { ...t, exitDate: action.exitDate, settlement: action.settlement } : t,
        ),
        payments: [...action.addPayments, ...state.payments.filter((p) => !removed.has(p.id))],
      };
    }
  }
}

type Store = State & {
  today: Date;
  period: string;
  addPayment: (payment: Omit<Payment, 'id'>) => void;
  /** Crée le bien et ses unités, renvoie l'identifiant du bien */
  addProperty: (property: Omit<Property, 'id'>, units: NewUnit[]) => string;
  addUnits: (propertyId: string, units: NewUnit[]) => void;
  /** Ajoute un locataire ; l'avance est enregistrée comme loyers payés pour les mois suivants. */
  addTenant: (input: NewTenant) => string;
  /** Enregistre le départ : solde de tout compte, impayés retenus sur la caution, unité libérée. */
  recordDeparture: (input: Departure) => Settlement;
};

export type Departure = {
  tenantId: string;
  exitDate: string;
  deductArrears: boolean;
  deductions: { label: string; amount: number }[];
  refundMethod?: PaymentMethod;
};

export type NewTenant = Omit<Tenant, 'id' | 'advanceMonthsLeft'> & {
  rent: number;
  advanceMonths: number;
  advanceMethod: PaymentMethod;
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
      addTenant: ({ rent, advanceMonths, advanceMethod, ...rest }) => {
        const id = newId('t');
        const now = new Date();
        // L'avance couvre les mois à partir du mois d'entrée
        const entry = rest.entryDate ? new Date(rest.entryDate) : now;
        const payments: Payment[] = Array.from({ length: advanceMonths }, (_, i) => ({
          id: newId('pay'),
          tenantId: id,
          amount: rent,
          method: advanceMethod,
          date: now.toISOString(),
          period: periodOf(new Date(entry.getFullYear(), entry.getMonth() + i, 1)),
        }));
        dispatch({ type: 'addTenant', tenant: { ...rest, id, advanceMonthsLeft: advanceMonths }, rent, payments });
        return id;
      },
      recordDeparture: ({ tenantId, exitDate, deductArrears, deductions, refundMethod }) => {
        const tenant = state.tenants.find((t) => t.id === tenantId)!;
        const rent = state.units.find((u) => u.id === tenant.unitId)!.rent;
        const { balanceDetail: b, arrearsDeducted, ...rest } = computeSettlement({
          tenant,
          rent,
          payments: state.payments,
          exitDate,
          deductArrears,
          deductions,
        });

        // Les impayés retenus deviennent des paiements « Retenue sur caution », du plus ancien au plus récent
        let left = arrearsDeducted;
        const addPayments: Payment[] = [];
        for (const a of b.arrearsByPeriod) {
          if (left <= 0) break;
          const amount = Math.min(a.amount, left);
          addPayments.push({ id: newId('pay'), tenantId, amount, method: 'caution', date: exitDate, period: a.period });
          left -= amount;
        }
        const settlement: Settlement = {
          ...rest,
          arrearsDeducted,
          refundMethod: rest.balance > 0 ? refundMethod : undefined,
        };
        dispatch({
          type: 'recordDeparture',
          tenantId,
          exitDate,
          settlement,
          addPayments,
          // L'avance des mois après le départ est rendue : ces paiements sont annulés
          removePaymentIds: b.prepaidPayments.map((p) => p.id),
        });
        return settlement;
      },
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
      tenants
        .filter((tenant) => !tenant.exitDate)
        .map((tenant) => {
          const unit = units.find((l) => l.id === tenant.unitId)!;
          const property = properties.find((p) => p.id === unit.propertyId)!;
          const paid = payments
            .filter((p) => p.tenantId === tenant.id && p.period === period)
            .reduce((sum, p) => sum + p.amount, 0);
          const entry = tenant.entryDate ? new Date(tenant.entryDate) : undefined;
          // Entrée dans un mois futur : rien n'est attendu ce mois-ci
          const notStarted = !!entry && periodOf(entry) > period;
          let dueDate = new Date(today.getFullYear(), today.getMonth(), tenant.dueDay);
          if (entry && entry > dueDate) dueDate = entry;
          const due = notStarted ? 0 : unit.rent;
          const status: TenantSummary['status'] = notStarted
            ? 'upcoming'
            : paid >= due
              ? 'paid'
              : paid > 0
                ? 'partial'
                : today > dueDate
                  ? 'late'
                  : 'upcoming';
          return { tenant, unit, property, status, paid, due, dueDate: dueDate.toISOString() };
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

/** Locataires partis, du départ le plus récent au plus ancien. */
export function useFormerTenants() {
  const { tenants, units, properties } = useStore();
  return useMemo(
    () =>
      tenants
        .filter((t) => t.exitDate)
        .sort((a, b) => b.exitDate!.localeCompare(a.exitDate!))
        .map((tenant) => {
          const unit = units.find((u) => u.id === tenant.unitId)!;
          return { tenant, unit, property: properties.find((p) => p.id === unit.propertyId)! };
        }),
    [tenants, units, properties],
  );
}
