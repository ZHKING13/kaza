import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';

import { periodOf } from '@/lib/format';

import { buildPayments, units, properties, tenants } from './mock';
import { computeSettlement } from './ledger';
import { type ProrataRule, rentForPeriod } from './prorata';
import type { Payment, PaymentMethod, Property, Settlement, Tenant, TenantSummary, Unit } from './types';

export type Settings = {
  prorata: ProrataRule;
};

/** Le bailleur : son nom figure sur les quittances. */
export type Profile = {
  firstName: string;
  lastName: string;
  phone: string;
};

type State = {
  profile: Profile;
  settings: Settings;
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  payments: Payment[];
};

type Action =
  | { type: 'setSettings'; settings: Partial<Settings> }
  | { type: 'setProfile'; profile: Partial<Profile> }
  | { type: 'addPayment'; payment: Payment }
  | { type: 'addProperty'; property: Property; units: Unit[] }
  | { type: 'addUnits'; units: Unit[] }
  | { type: 'addTenant'; tenant: Tenant; rent: number; payments: Payment[] }
  | { type: 'recordDeparture'; tenantId: string; exitDate: string; settlement: Settlement; addPayments: Payment[]; removePaymentIds: string[] };

export type NewUnit = Pick<Unit, 'label' | 'rent'>;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setProfile':
      return { ...state, profile: { ...state.profile, ...action.profile } };
    case 'setSettings':
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case 'addPayment':
      return {
        ...state,
        payments: [action.payment, ...state.payments],
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
  /** Enregistre un paiement et renvoie son identifiant */
  addPayment: (payment: Omit<Payment, 'id'>) => string;
  setSettings: (settings: Partial<Settings>) => void;
  setProfile: (profile: Partial<Profile>) => void;
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

/** Mois couverts par une avance de `months` mois à partir du mois d'entrée. */
export function advancePeriods(months: number, entry: Date): string[] {
  return Array.from({ length: months }, (_, i) => periodOf(new Date(entry.getFullYear(), entry.getMonth() + i, 1)));
}

let seq = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;
const toUnits = (propertyId: string, units: NewUnit[]): Unit[] =>
  units.map((u) => ({ id: newId('u'), propertyId, label: u.label.trim(), rent: u.rent }));

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const today = useMemo(() => new Date(), []);
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    profile: { firstName: 'Kouassi', lastName: 'Brou', phone: '+2250700112233' },
    settings: { prorata: 'full' as ProrataRule },
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
      addPayment: (payment) => {
        const id = newId('pay');
        dispatch({ type: 'addPayment', payment: { ...payment, id } });
        return id;
      },
      setSettings: (settings) => dispatch({ type: 'setSettings', settings }),
      setProfile: (profile) => dispatch({ type: 'setProfile', profile }),
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
        const payments: Payment[] = advancePeriods(advanceMonths, entry).map((period) => ({
          id: newId('pay'),
          tenantId: id,
          amount: rentForPeriod(rent, period, state.settings.prorata, rest.entryDate).amount,
          method: advanceMethod,
          date: now.toISOString(),
          period,
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
          rule: state.settings.prorata,
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
  const { tenants, units, properties, payments, today, period, settings } = useStore();
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
          const due = rentForPeriod(unit.rent, period, settings.prorata, tenant.entryDate).amount;
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
    [tenants, units, properties, payments, today, period, settings.prorata],
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
