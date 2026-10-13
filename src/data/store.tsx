import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useReducer, useRef } from 'react';

import { api } from '@/lib/api';
import { endSession } from '@/lib/auth';
import { isApiConfigured } from '@/lib/config';
import { periodOf } from '@/lib/format';

import { countries, splitPhone } from './countries';

import { buildPayments, units, properties, tenants } from './mock';
import { computeSettlement } from './ledger';
import { type ProrataRule, rentForPeriod } from './prorata';
import { type ApiUser, remote, type RemoteData, toPayment } from './remote';
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

/** Session de l'utilisateur connecté (fournie par lib/auth). */
export type Session = {
  provider: 'phone' | 'google' | 'apple' | 'demo';
  /** Numéro E.164 pour la connexion par téléphone */
  phone?: string;
  email?: string;
  signedInAt: string;
};

type State = {
  /** Vrai une fois l'état relu depuis le téléphone */
  hydrated: boolean;
  session: Session | null;
  /** Profil et premier bien renseignés */
  onboarded: boolean;
  /** 'demo' : données d'exemple ; 'real' : les biens de l'utilisateur */
  mode: 'demo' | 'real';
  /** Compte sur le serveur Kaza : les données ci-dessous sont un cache du serveur */
  remote: boolean;
  /** Espace (organisation) du compte sur le serveur */
  organizationId: string | null;
  /** Dernière synchronisation réussie avec le serveur (ISO) */
  syncedAt: string | null;
  profile: Profile;
  settings: Settings;
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  payments: Payment[];
};

type Action =
  | { type: 'hydrate'; state: Partial<State> }
  | { type: 'signIn'; session: Session; profile?: Partial<Profile> }
  | { type: 'completeOnboarding' }
  | { type: 'loadDemo'; state: Partial<State> }
  | { type: 'signOut' }
  | { type: 'remoteAccount'; profile: Partial<Profile>; organizationId: string | null }
  | { type: 'remoteLoaded'; data: RemoteData; syncedAt: string }
  | { type: 'setOrganization'; organizationId: string }
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
    case 'hydrate':
      return { ...state, ...action.state, hydrated: true };
    case 'signIn':
      return { ...state, session: action.session, profile: { ...state.profile, ...action.profile } };
    case 'completeOnboarding':
      return { ...state, onboarded: true };
    case 'loadDemo':
      return { ...state, ...action.state };
    case 'signOut':
      return { ...emptyState(), hydrated: true };
    case 'remoteAccount':
      return {
        ...state,
        remote: true,
        organizationId: action.organizationId,
        profile: { ...state.profile, ...action.profile },
      };
    case 'setOrganization':
      return { ...state, organizationId: action.organizationId };
    case 'remoteLoaded': {
      // Les photos ne sont pas encore envoyées au serveur : on garde celles du téléphone
      const photos = new Map(state.properties.filter((p) => p.photo).map((p) => [p.id, p.photo]));
      return {
        ...state,
        onboarded: true,
        organizationId: action.data.organization.id,
        settings: { ...state.settings, prorata: action.data.organization.prorataRule },
        properties: action.data.properties.map((p) => ({ ...p, photo: photos.get(p.id) })),
        units: action.data.units,
        tenants: action.data.tenants,
        payments: action.data.payments,
        syncedAt: action.syncedAt,
      };
    }
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

/**
 * Les écritures renvoient une promesse : avec un compte sur le serveur, elles ne modifient le
 * téléphone qu'une fois acceptées par le serveur (identifiants et montants du serveur). En cas
 * d'erreur, la promesse est rejetée avec un message prêt à afficher (`errorMessage`).
 */
type Store = State & {
  today: Date;
  period: string;
  signIn: (session: Omit<Session, 'signedInAt'>, profile?: Partial<Profile>) => void;
  /** Après une connexion au serveur : profil et espace du compte, données si l'espace existe */
  setRemoteAccount: (user: ApiUser) => Promise<void>;
  /** Relit les données du serveur (sans effet hors compte en ligne) */
  refresh: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  /** Ouvre l'application avec les données d'exemple, sans compte */
  startDemo: () => void;
  /** Déconnecte et efface les données de ce téléphone */
  signOut: () => void;
  /** Enregistre un paiement et renvoie son identifiant */
  addPayment: (payment: Omit<Payment, 'id'>) => Promise<string>;
  setSettings: (settings: Partial<Settings>) => Promise<void>;
  setProfile: (profile: Partial<Profile>) => Promise<void>;
  /** Crée le bien et ses unités, renvoie l'identifiant du bien */
  addProperty: (property: Omit<Property, 'id'>, units: NewUnit[]) => Promise<string>;
  addUnits: (propertyId: string, units: NewUnit[]) => Promise<void>;
  /** Ajoute un locataire ; l'avance est enregistrée comme loyers payés pour les mois suivants. */
  addTenant: (input: NewTenant) => Promise<string>;
  /** Enregistre le départ : solde de tout compte, impayés retenus sur la caution, unité libérée. */
  recordDeparture: (input: Departure) => Promise<Settlement>;
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

const STORAGE_KEY = 'kaza/state/v1';
/** Champs sauvegardés sur le téléphone */
const PERSISTED = [
  'session',
  'onboarded',
  'mode',
  'remote',
  'organizationId',
  'syncedAt',
  'profile',
  'settings',
  'properties',
  'units',
  'tenants',
  'payments',
] as const;

function emptyState(): State {
  return {
    hydrated: false,
    session: null,
    onboarded: false,
    mode: 'real',
    remote: false,
    organizationId: null,
    syncedAt: null,
    profile: { firstName: '', lastName: '', phone: '' },
    settings: { prorata: 'full' },
    properties: [],
    units: [],
    tenants: [],
    payments: [],
  };
}

function demoState(today: Date): Partial<State> {
  return {
    session: { provider: 'demo', signedInAt: today.toISOString() },
    onboarded: true,
    mode: 'demo',
    profile: { firstName: 'Kouassi', lastName: 'Brou', phone: '+2250700112233' },
    properties,
    units,
    tenants,
    payments: buildPayments(today),
  };
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const today = useMemo(() => new Date(), []);
  const [state, dispatch] = useReducer(reducer, undefined, emptyState);

  // Relit l'état sauvegardé au démarrage
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => dispatch({ type: 'hydrate', state: raw ? (JSON.parse(raw) as Partial<State>) : {} }))
      .catch(() => dispatch({ type: 'hydrate', state: {} }));
  }, []);

  // Session révoquée ou expirée sur le serveur : retour à l'écran de connexion
  useEffect(() => {
    api.onSessionExpired(() => {
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      dispatch({ type: 'signOut' });
    });
    return () => api.onSessionExpired(null);
  }, []);

  // Compte en ligne : l'application s'ouvre sur le cache, puis se met à jour depuis le serveur
  const startupSync = useRef(false);
  useEffect(() => {
    if (!state.hydrated || startupSync.current) return;
    startupSync.current = true;
    if (state.remote && state.session && state.organizationId) {
      remote
        .snapshot(state.organizationId, new Date())
        .then((data) => dispatch({ type: 'remoteLoaded', data, syncedAt: new Date().toISOString() }))
        .catch(() => {});
    }
  }, [state.hydrated, state.remote, state.session, state.organizationId]);

  // Sauvegarde après chaque changement (regroupé sur 300 ms)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!state.hydrated) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const data = Object.fromEntries(PERSISTED.map((k) => [k, state[k]]));
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
    }, 300);
  }, [state]);

  // Espace du compte, lu par les écritures qui s'enchaînent (le premier bien crée l'espace, puis
  // « Enregistrer et commencer » doit le retrouver avant même le rendu suivant)
  const organizationRef = useRef<string | null>(null);
  const creatingOrganization = useRef<Promise<string> | null>(null);
  organizationRef.current = state.organizationId ?? organizationRef.current;
  if (!state.session) organizationRef.current = null;

  const value = useMemo<Store>(() => {
    const online = state.remote && isApiConfigured;

    const loadRemote = async (organizationId: string) => {
      const data = await remote.snapshot(organizationId, new Date());
      dispatch({ type: 'remoteLoaded', data, syncedAt: new Date().toISOString() });
    };

    /** Espace du compte ; créé au premier bien (ou à la fin de l'onboarding) s'il n'existe pas. */
    const ensureOrganization = async (): Promise<string> => {
      if (organizationRef.current) return organizationRef.current;
      creatingOrganization.current ??= (async () => {
        const country = splitPhone(state.profile.phone || '', countries[0]).country;
        const name = `${state.profile.firstName} ${state.profile.lastName}`.trim() || 'Mon espace';
        const organization = await remote.createOrganization(name, country.code);
        organizationRef.current = organization.id;
        dispatch({ type: 'setOrganization', organizationId: organization.id });
        if (state.settings.prorata !== organization.prorataRule) {
          await remote.updateOrganization(organization.id, { prorataRule: state.settings.prorata });
        }
        return organization.id;
      })().finally(() => {
        creatingOrganization.current = null;
      });
      return creatingOrganization.current;
    };

    return {
      ...state,
      today,
      period: periodOf(today),
      signIn: (session, profile) => dispatch({ type: 'signIn', session: { ...session, signedInAt: new Date().toISOString() }, profile }),
      setRemoteAccount: async (user) => {
        const { organizations } = await remote.me();
        const organizationId = organizations[0]?.id ?? null;
        organizationRef.current = organizationId;
        dispatch({
          type: 'remoteAccount',
          organizationId,
          profile: {
            firstName: user.firstName ?? '',
            lastName: user.lastName ?? '',
            phone: user.phone ?? state.profile.phone,
          },
        });
        // Compte existant (téléphone changé, réinstallation) : on retrouve ses données
        if (organizationId) await loadRemote(organizationId);
      },
      refresh: async () => {
        if (online && organizationRef.current) await loadRemote(organizationRef.current);
      },
      completeOnboarding: async () => {
        if (online) await ensureOrganization();
        dispatch({ type: 'completeOnboarding' });
      },
      startDemo: () => dispatch({ type: 'loadDemo', state: demoState(new Date()) }),
      signOut: () => {
        if (state.remote) endSession().catch(() => {});
        AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
        dispatch({ type: 'signOut' });
      },
      setSettings: async (settings) => {
        if (online && settings.prorata && organizationRef.current) {
          await remote.updateOrganization(organizationRef.current, { prorataRule: settings.prorata });
        }
        dispatch({ type: 'setSettings', settings });
      },
      setProfile: async (profile) => {
        if (online) {
          const firstName = profile.firstName ?? state.profile.firstName;
          const lastName = profile.lastName ?? state.profile.lastName;
          if (firstName && lastName) await remote.updateProfile(firstName, lastName);
        }
        dispatch({ type: 'setProfile', profile });
      },
      addPayment: async (payment) => {
        if (online) {
          const organizationId = await ensureOrganization();
          const saved = await remote.createPayment(organizationId, {
            leaseId: payment.tenantId,
            amount: payment.amount,
            method: payment.method,
            period: payment.period,
            receivedAt: payment.date,
          });
          dispatch({ type: 'addPayment', payment: saved });
          return saved.id;
        }
        const id = newId('pay');
        dispatch({ type: 'addPayment', payment: { ...payment, id } });
        return id;
      },
      addProperty: async (property, units) => {
        if (online) {
          const organizationId = await ensureOrganization();
          const { photo, ...rest } = property;
          const saved = await remote.createProperty(
            organizationId,
            rest,
            units.map((u) => ({ label: u.label.trim(), rent: u.rent })),
          );
          dispatch({
            type: 'addProperty',
            property: { ...property, id: saved.id, photo },
            units: saved.units.map((u) => ({ ...u, propertyId: saved.id })),
          });
          return saved.id;
        }
        const id = newId('p');
        dispatch({ type: 'addProperty', property: { ...property, id }, units: toUnits(id, units) });
        return id;
      },
      addUnits: async (propertyId, units) => {
        if (online) {
          const organizationId = await ensureOrganization();
          const saved = await remote.addUnits(
            organizationId,
            propertyId,
            units.map((u) => ({ label: u.label.trim(), rent: u.rent })),
          );
          dispatch({ type: 'addUnits', units: saved.map((u) => ({ ...u, propertyId })) });
          return;
        }
        dispatch({ type: 'addUnits', units: toUnits(propertyId, units) });
      },
      addTenant: async ({ rent, advanceMonths, advanceMethod, ...rest }) => {
        if (online) {
          const organizationId = await ensureOrganization();
          // Le serveur calcule la caution et l'avance (règle de prorata de l'espace)
          const saved = await remote.createLease(organizationId, {
            unitId: rest.unitId,
            tenant: { firstName: rest.firstName, lastName: rest.lastName, phone: rest.phone },
            rent,
            dueDay: rest.dueDay,
            entryDate: rest.entryDate,
            depositMonths: rest.depositMonths,
            advance: advanceMonths > 0 ? { months: advanceMonths, method: advanceMethod } : undefined,
          });
          const id = saved.lease.id;
          dispatch({
            type: 'addTenant',
            tenant: { ...rest, id, advanceMonthsLeft: advanceMonths },
            rent,
            payments: saved.payments.map(toPayment),
          });
          return id;
        }
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
      recordDeparture: async ({ tenantId, exitDate, deductArrears, deductions, refundMethod }) => {
        if (online) {
          throw new Error('Le départ d’un locataire n’est pas encore enregistré sur le serveur. Il arrive avec la prochaine mise à jour.');
        }
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
    };
  }, [state, today]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}

const dayKey = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

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
                : // En retard le lendemain de l'échéance (même règle que periodRentStatus du serveur)
                  dayKey(today) > dayKey(dueDate)
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
