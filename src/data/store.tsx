import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { api, errorMessage, newIdempotencyKey } from '@/lib/api';
import { endSession } from '@/lib/auth';
import { isApiConfigured } from '@/lib/config';
import { formatAmount, periodOf } from '@/lib/format';

import { countries, splitPhone } from './countries';

import { buildPayments, demoTenants, properties, units } from './mock';
import { computeSettlement } from './ledger';
import { type ProrataRule, rentForPeriod } from './prorata';
import {
  defaultLeaseSettings,
  lastRentChange,
  type LeaseEnd,
  leaseEnd,
  type LeaseSettings,
  rentAt,
  rentRevisionDue,
  tenantRent,
  toCalendar,
} from './rent';
import { isRetryable, type OutboxDraft, type OutboxEntry, type OutboxFailure, type OutboxResult, retryDelay, sendOutboxEntry } from './outbox';
import {
  type ApiOrganization,
  type ApiUser,
  calendarDate,
  type MessagingSettings,
  type ReceivedInvitation,
  remote,
  type RemoteData,
  type Role,
} from './remote';
import type { Notice, Payment, PaymentMethod, Property, RentRevision, Settlement, Tenant, TenantSummary, Unit } from './types';

export type OrganizationSummary = { id: string; name: string; role: Role; type?: 'individual' | 'agency' };

const toSummary = (o: ApiOrganization): OrganizationSummary => ({ id: o.id, name: o.name, role: o.role, type: o.type });

export type Settings = {
  prorata: ProrataRule;
  /** Messages envoyés par le serveur aux locataires (compte en ligne seulement) */
  messaging?: MessagingSettings;
  /** Liens de paiement mobile money disponibles sur le serveur */
  onlinePayments?: boolean;
  /** Préavis par défaut et seuils des alertes (valeurs par défaut sans compte en ligne) */
  leases?: LeaseSettings;
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
  /** Espace (organisation) ouvert dans l'application */
  organizationId: string | null;
  /** Espaces du compte (le sien, ceux où il a été invité) et son rôle dans chacun */
  organizations: OrganizationSummary[];
  /** Invitations reçues sur le numéro du compte, en attente (relues à la connexion et à l'actualisation) */
  invitations: ReceivedInvitation[];
  /** Dernière synchronisation réussie avec le serveur (ISO) */
  syncedAt: string | null;
  /** Écritures pas encore envoyées au serveur (pas de réseau), dans l'ordre */
  outbox: OutboxEntry[];
  /** Écritures refusées par le serveur au moment de l'envoi, à montrer à l'utilisateur */
  outboxFailures: OutboxFailure[];
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
  | { type: 'setOrganization'; organizationId: string | null }
  | { type: 'setOrganizations'; organizations: OrganizationSummary[] }
  | { type: 'upsertOrganization'; organization: OrganizationSummary }
  | { type: 'setInvitations'; invitations: ReceivedInvitation[] }
  /** Ouvre un autre espace : les données de l'ancien quittent le téléphone en attendant celles du nouveau */
  | { type: 'switchOrganization'; organizationId: string }
  /** Plus aucun espace (retiré ou parti) : retour à l'onboarding */
  | { type: 'noOrganization' }
  | { type: 'enqueue'; entry: OutboxEntry }
  | { type: 'dequeue'; key: string }
  | { type: 'outboxAttempt'; key: string }
  | { type: 'outboxFailed'; failure: OutboxFailure }
  | { type: 'dismissOutboxFailures' }
  | { type: 'replaceLeasePayments'; leaseId: string; removeIds: string[]; payments: Payment[] }
  | { type: 'setSettlement'; tenantId: string; settlement: Settlement }
  | { type: 'removePayment'; paymentId: string }
  | { type: 'setSettings'; settings: Partial<Settings> }
  | { type: 'setProfile'; profile: Partial<Profile> }
  | { type: 'addPayment'; payment: Payment }
  | { type: 'addProperty'; property: Property; units: Unit[] }
  | { type: 'addUnits'; units: Unit[] }
  | { type: 'addTenant'; tenant: Tenant; rent: number; payments: Payment[] }
  | { type: 'updateTenant'; tenantId: string; patch: Partial<Tenant> }
  | { type: 'setUnitRent'; unitId: string; rent: number }
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
    case 'setOrganizations':
      return { ...state, organizations: action.organizations };
    case 'upsertOrganization':
      return {
        ...state,
        organizations: state.organizations.some((o) => o.id === action.organization.id)
          ? state.organizations.map((o) => (o.id === action.organization.id ? action.organization : o))
          : [...state.organizations, action.organization],
      };
    case 'setInvitations':
      return { ...state, invitations: action.invitations };
    case 'switchOrganization':
      return {
        ...state,
        onboarded: true,
        organizationId: action.organizationId,
        properties: [],
        units: [],
        tenants: [],
        payments: [],
        syncedAt: null,
        settings: { prorata: 'full' },
      };
    case 'noOrganization':
      return {
        ...state,
        onboarded: false,
        organizationId: null,
        organizations: [],
        properties: [],
        units: [],
        tenants: [],
        payments: [],
        syncedAt: null,
        outbox: [],
        settings: { prorata: 'full' },
      };
    case 'enqueue':
      return { ...state, outbox: [...state.outbox, action.entry] };
    case 'dequeue':
      return { ...state, outbox: state.outbox.filter((e) => e.key !== action.key) };
    case 'outboxAttempt':
      return { ...state, outbox: state.outbox.map((e) => (e.key === action.key ? { ...e, attempts: e.attempts + 1 } : e)) };
    case 'outboxFailed':
      return {
        ...state,
        outbox: state.outbox.filter((e) => e.key !== action.failure.key),
        outboxFailures: [...state.outboxFailures, action.failure],
      };
    case 'dismissOutboxFailures':
      return { ...state, outboxFailures: [] };
    case 'setSettlement':
      return {
        ...state,
        tenants: state.tenants.map((t) => (t.id === action.tenantId ? { ...t, settlement: action.settlement } : t)),
      };
    case 'removePayment':
      return { ...state, payments: state.payments.filter((p) => p.id !== action.paymentId) };
    case 'replaceLeasePayments': {
      // L'avance calculée sur le téléphone est remplacée par celle du serveur (identifiants du serveur)
      const removed = new Set(action.removeIds);
      const known = new Set(state.payments.map((p) => p.id));
      return {
        ...state,
        payments: [...action.payments.filter((p) => !known.has(p.id)), ...state.payments.filter((p) => !removed.has(p.id))],
      };
    }
    case 'remoteLoaded': {
      // Les photos ne sont pas encore envoyées au serveur : on garde celles du téléphone
      const photos = new Map(state.properties.filter((p) => p.photo).map((p) => [p.id, p.photo]));
      return {
        ...state,
        onboarded: true,
        organizationId: action.data.organization.id,
        organizations: state.organizations.some((o) => o.id === action.data.organization.id)
          ? state.organizations.map((o) => (o.id === action.data.organization.id ? toSummary(action.data.organization) : o))
          : [...state.organizations, toSummary(action.data.organization)],
        settings: {
          ...state.settings,
          prorata: action.data.organization.prorataRule,
          messaging: action.data.organization.messaging,
          onlinePayments: action.data.organization.onlinePaymentsEnabled ?? false,
          leases: action.data.organization.leases ?? state.settings.leases,
        },
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
    case 'updateTenant':
      return { ...state, tenants: state.tenants.map((t) => (t.id === action.tenantId ? { ...t, ...action.patch } : t)) };
    case 'setUnitRent':
      return { ...state, units: state.units.map((u) => (u.id === action.unitId ? { ...u, rent: action.rent } : u)) };
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
  /** Révise le loyer à partir d'un mois (au plus tôt le mois en cours) ; les mois passés gardent leur loyer. */
  reviseRent: (input: RentRevisionInput) => Promise<void>;
  /** Retire une révision qui ne porte pas sur un mois passé */
  cancelRentRevision: (tenantId: string, revisionId: string) => Promise<void>;
  /** Fin du contrat (ISO), ou null : durée indéterminée */
  setEndDate: (tenantId: string, endDate: string | null) => Promise<void>;
  /** Enregistre un préavis (Kaza ne le signifie pas au locataire) */
  giveNotice: (tenantId: string, notice: Notice) => Promise<void>;
  withdrawNotice: (tenantId: string) => Promise<void>;
  /** Annule un paiement (erreur de saisie, argent non reçu…) : il disparaît des montants encaissés. */
  voidPayment: (paymentId: string, reason: string) => Promise<void>;
  /** Ouvre un autre espace du compte (refusé tant que des enregistrements attendent d'être envoyés) */
  switchOrganization: (organizationId: string) => Promise<void>;
  /** Rejoint l'espace qui a invité ce numéro, et l'ouvre */
  acceptInvitation: (invitationId: string) => Promise<void>;
  declineInvitation: (invitationId: string) => Promise<void>;
  /** Quitte l'espace ouvert (pas le sien) : ouvre un autre espace, ou revient à l'onboarding */
  leaveOrganization: (myUserId: string) => Promise<void>;
  /** Relance tout de suite l'envoi des écritures en attente */
  retryOutbox: () => void;
  dismissOutboxFailures: () => void;
};

export type Departure = {
  tenantId: string;
  exitDate: string;
  deductArrears: boolean;
  deductions: { label: string; amount: number }[];
  refundMethod?: PaymentMethod;
};

export type RentRevisionInput = {
  tenantId: string;
  amount: number;
  /** Premier mois concerné, "YYYY-MM" */
  from: string;
  reason?: string;
  /** Prévenir le locataire par WhatsApp (compte en ligne) */
  notifyTenant: boolean;
  /** Le logement prend ce loyer pour les prochains locataires */
  applyToUnit: boolean;
};

export type NewTenant = Omit<Tenant, 'id' | 'advanceMonthsLeft' | 'rent' | 'rents' | 'notice'> & {
  rent: number;
  advanceMonths: number;
  advanceMethod: PaymentMethod;
};

/** Mois couverts par une avance de `months` mois à partir du mois d'entrée. */
export function advancePeriods(months: number, entry: Date): string[] {
  return Array.from({ length: months }, (_, i) => periodOf(new Date(entry.getFullYear(), entry.getMonth() + i, 1)));
}

/** Identifiants choisis par le téléphone (UUID) : une création faite hors ligne garde le même identifiant sur le serveur. */
const newId = (): string => Crypto.randomUUID();
const toUnits = (propertyId: string, units: NewUnit[]): Unit[] =>
  units.map((u) => ({ id: newId(), propertyId, label: u.label.trim(), rent: u.rent }));

const STORAGE_KEY = 'kaza/state/v1';
/** Champs sauvegardés sur le téléphone */
const PERSISTED = [
  'session',
  'onboarded',
  'mode',
  'remote',
  'organizationId',
  'organizations',
  'syncedAt',
  'profile',
  'settings',
  'properties',
  'units',
  'tenants',
  'payments',
  'outbox',
  'outboxFailures',
] as const;

function emptyState(): State {
  return {
    hydrated: false,
    session: null,
    onboarded: false,
    mode: 'real',
    remote: false,
    organizationId: null,
    organizations: [],
    invitations: [],
    syncedAt: null,
    profile: { firstName: '', lastName: '', phone: '' },
    settings: { prorata: 'full' },
    properties: [],
    units: [],
    tenants: [],
    payments: [],
    outbox: [],
    outboxFailures: [],
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
    tenants: demoTenants(today),
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

  // Dernier état, pour la file d'envoi qui tourne entre deux rendus
  const stateRef = useRef(state);
  stateRef.current = state;

  /** Ouvre un espace : vide les données de l'ancien, puis lit celles du nouveau. */
  const openOrganization = async (organizationId: string) => {
    organizationRef.current = organizationId;
    dispatch({ type: 'switchOrganization', organizationId });
    await loadRemote(organizationId);
  };

  /**
   * Espaces et invitations du compte, relus depuis le serveur. Si l'espace ouvert n'en fait plus partie
   * (membre retiré), on ouvre le suivant, ou on revient à l'onboarding.
   */
  const refreshAccount = async () => {
    const { organizations } = await remote.me();
    dispatch({ type: 'setOrganizations', organizations: organizations.map(toSummary) });
    dispatch({ type: 'setInvitations', invitations: await remote.receivedInvitations().catch(() => []) });
    const current = organizationRef.current;
    if (current && !organizations.some((o) => o.id === current)) {
      if (organizations[0]) await openOrganization(organizations[0].id);
      else {
        organizationRef.current = null;
        dispatch({ type: 'noOrganization' });
      }
    }
  };

  const loadRemote = async (organizationId: string) => {
    const data = await remote.snapshot(organizationId, new Date());
    // Des écritures attendent encore d'être envoyées : le serveur ne les connaît pas, on garde le téléphone
    if (stateRef.current.outbox.length > 0) return;
    dispatch({ type: 'remoteLoaded', data, syncedAt: new Date().toISOString() });
  };

  // ── File d'envoi ──────────────────────────────────────────────────────────────
  const flushing = useRef(false);
  const flushAgain = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const afterSent = (result: OutboxResult) => {
    if (result.kind === 'organization') {
      dispatch({ type: 'upsertOrganization', organization: toSummary(result.organization) });
      // Réglages des messages tels que le serveur les a enregistrés
      dispatch({
        type: 'setSettings',
        settings: {
          ...(result.organization.messaging ? { messaging: result.organization.messaging } : {}),
          ...(result.organization.leases ? { leases: result.organization.leases } : {}),
          onlinePayments: result.organization.onlinePaymentsEnabled ?? false,
        },
      });
    }
    if (result.kind === 'lease') {
      dispatch({ type: 'replaceLeasePayments', leaseId: result.leaseId, removeIds: result.localPaymentIds, payments: result.payments });
    }
    if (result.kind === 'departure') {
      // Montants et retenues du serveur (il a recalculé le solde avec ses données)
      dispatch({ type: 'setSettlement', tenantId: result.leaseId, settlement: result.settlement });
      dispatch({ type: 'replaceLeasePayments', leaseId: result.leaseId, removeIds: result.localPaymentIds, payments: result.payments });
      for (const paymentId of result.voidedPaymentIds) dispatch({ type: 'removePayment', paymentId });
    }
  };

  const scheduleRetry = (attempts: number) => {
    clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => void flush(), retryDelay(attempts));
  };

  /** Envoie les écritures en attente, dans l'ordre ; s'arrête au premier échec réseau. */
  const flush = async (): Promise<void> => {
    if (flushing.current) {
      flushAgain.current = true;
      return;
    }
    const { remote: online, session } = stateRef.current;
    if (!online || !session || !isApiConfigured) return;
    flushing.current = true;
    clearTimeout(retryTimer.current);
    const done = new Set<string>();
    let sentOrRefused = 0;
    let blocked = false;
    try {
      for (;;) {
        const next = stateRef.current.outbox.find((e) => !done.has(e.key));
        if (!next) break;
        try {
          const result = await sendOutboxEntry(next);
          done.add(next.key);
          sentOrRefused++;
          afterSent(result);
          dispatch({ type: 'dequeue', key: next.key });
        } catch (error) {
          if (isRetryable(error)) {
            dispatch({ type: 'outboxAttempt', key: next.key });
            scheduleRetry(next.attempts + 1);
            blocked = true;
            break;
          }
          // Refusée par le serveur : la rejouer ne changerait rien. On la retire et on prévient.
          done.add(next.key);
          sentOrRefused++;
          dispatch({
            type: 'outboxFailed',
            failure: { key: next.key, label: next.label, message: errorMessage(error), at: new Date().toISOString() },
          });
        }
      }
    } finally {
      flushing.current = false;
    }
    // File vide : le serveur fait foi (retire aussi du téléphone ce qui a été refusé)
    if (!blocked && sentOrRefused > 0 && stateRef.current.organizationId) {
      await new Promise((r) => setTimeout(r, 0));
      await loadRemote(stateRef.current.organizationId).catch(() => {});
    }
    if (flushAgain.current) {
      flushAgain.current = false;
      await flush();
    }
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;

  // Au démarrage : envoyer ce qui attend, sinon relire le serveur. L'application s'ouvre sur le cache.
  const startupSync = useRef(false);
  useEffect(() => {
    if (!state.hydrated || startupSync.current) return;
    startupSync.current = true;
    if (!state.remote || !state.session) return;
    if (state.outbox.length > 0) void flushRef.current();
    else if (state.organizationId) loadRemote(state.organizationId).catch(() => {});
    // Rôles et invitations ont pu changer depuis la dernière ouverture
    refreshAccount().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.hydrated]);

  // Retour dans l'application ou du réseau (web) : nouvelle tentative
  useEffect(() => {
    const retry = () => {
      if (stateRef.current.outbox.length > 0) void flushRef.current();
    };
    const sub = AppState.addEventListener('change', (s) => s === 'active' && retry());
    if (Platform.OS === 'web') globalThis.addEventListener?.('online', retry);
    return () => {
      sub.remove();
      if (Platform.OS === 'web') globalThis.removeEventListener?.('online', retry);
      clearTimeout(retryTimer.current);
    };
  }, []);

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

    /**
     * Une écriture vers le serveur. File vide : envoi direct, le téléphone n'est modifié qu'après
     * l'accord du serveur (une erreur de saisie s'affiche dans le formulaire). Sans réseau, ou si
     * d'autres écritures attendent déjà : modification du téléphone tout de suite et mise en file.
     */
    const write = async (op: OutboxDraft, applyLocal: () => void) => {
      const entry = { ...op, key: newIdempotencyKey(), createdAt: new Date().toISOString(), attempts: 0 } as OutboxEntry;
      if (stateRef.current.outbox.length === 0 && !flushing.current) {
        try {
          const result = await sendOutboxEntry(entry);
          applyLocal();
          afterSent(result);
          return;
        } catch (error) {
          if (!isRetryable(error)) throw error;
          applyLocal();
          dispatch({ type: 'enqueue', entry: { ...entry, attempts: 1 } });
          scheduleRetry(1);
          return;
        }
      }
      applyLocal();
      dispatch({ type: 'enqueue', entry });
      setTimeout(() => void flushRef.current(), 0);
    };

    /** Espace du compte ; créé au premier bien (ou à la fin de l'onboarding) s'il n'existe pas. */
    const ensureOrganization = async (): Promise<string> => {
      if (organizationRef.current) return organizationRef.current;
      creatingOrganization.current ??= (async () => {
        const country = splitPhone(state.profile.phone || '', countries[0]).country;
        const name = `${state.profile.firstName} ${state.profile.lastName}`.trim() || 'Mon espace';
        const id = newId();
        organizationRef.current = id;
        try {
          await write(
            {
              kind: 'createOrganization',
              body: { id, name, countryCode: country.code },
              prorataRule: state.settings.prorata,
              label: `Espace « ${name} »`,
            },
            () => dispatch({ type: 'setOrganization', organizationId: id }),
          );
        } catch (error) {
          organizationRef.current = null;
          throw error;
        }
        return id;
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
        dispatch({ type: 'setOrganizations', organizations: organizations.map(toSummary) });
        dispatch({ type: 'setInvitations', invitations: await remote.receivedInvitations().catch(() => []) });
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
        if (!online) return;
        await refreshAccount();
        if (stateRef.current.outbox.length > 0) await flushRef.current();
        else if (organizationRef.current) await loadRemote(organizationRef.current);
      },
      switchOrganization: async (organizationId) => {
        if (organizationId === organizationRef.current) return;
        if (stateRef.current.outbox.length > 0) {
          throw new Error('Des enregistrements attendent d’être envoyés. Changez d’espace une fois la connexion revenue.');
        }
        await openOrganization(organizationId);
      },
      acceptInvitation: async (invitationId) => {
        const organization = await remote.acceptInvitation(invitationId);
        dispatch({ type: 'upsertOrganization', organization: toSummary(organization) });
        dispatch({ type: 'setInvitations', invitations: stateRef.current.invitations.filter((i) => i.id !== invitationId) });
        if (stateRef.current.outbox.length === 0) await openOrganization(organization.id);
      },
      declineInvitation: async (invitationId) => {
        await remote.declineInvitation(invitationId);
        dispatch({ type: 'setInvitations', invitations: stateRef.current.invitations.filter((i) => i.id !== invitationId) });
      },
      leaveOrganization: async (myUserId) => {
        const left = organizationRef.current;
        if (!left) return;
        await remote.removeMember(left, myUserId);
        dispatch({ type: 'setOrganizations', organizations: stateRef.current.organizations.filter((o) => o.id !== left) });
        const next = stateRef.current.organizations.find((o) => o.id !== left);
        if (next) await openOrganization(next.id);
        else {
          organizationRef.current = null;
          dispatch({ type: 'noOrganization' });
        }
      },
      retryOutbox: () => void flushRef.current(),
      dismissOutboxFailures: () => dispatch({ type: 'dismissOutboxFailures' }),
      completeOnboarding: async () => {
        if (online) await ensureOrganization();
        dispatch({ type: 'completeOnboarding' });
      },
      startDemo: () => dispatch({ type: 'loadDemo', state: demoState(new Date()) }),
      signOut: () => {
        if (state.remote) endSession().catch(() => {});
        clearTimeout(retryTimer.current);
        AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
        dispatch({ type: 'signOut' });
      },
      setSettings: async (settings) => {
        const messaging = settings.messaging;
        const merged = messaging && state.settings.messaging ? { ...state.settings.messaging, ...messaging } : messaging;
        const leases = settings.leases;
        const mergedLeases = leases ? { ...(state.settings.leases ?? defaultLeaseSettings), ...leases } : undefined;
        const apply = () =>
          dispatch({
            type: 'setSettings',
            settings: { ...settings, ...(merged ? { messaging: merged } : {}), ...(mergedLeases ? { leases: mergedLeases } : {}) },
          });
        // Sans espace encore, la règle part avec la création de l'espace
        if (online && (settings.prorata || messaging || leases) && organizationRef.current) {
          await write(
            {
              kind: 'updateOrganization',
              orgId: organizationRef.current,
              body: {
                ...(settings.prorata ? { prorataRule: settings.prorata } : {}),
                ...(messaging ? { messaging } : {}),
                ...(leases ? { leases } : {}),
              },
              label: messaging ? 'Messages aux locataires' : leases ? 'Préavis et alertes' : 'Règle des mois incomplets',
            },
            apply,
          );
          return;
        }
        apply();
      },
      setProfile: async (profile) => {
        const apply = () => dispatch({ type: 'setProfile', profile });
        const firstName = profile.firstName ?? state.profile.firstName;
        const lastName = profile.lastName ?? state.profile.lastName;
        if (online && firstName && lastName) {
          await write({ kind: 'updateProfile', body: { firstName, lastName }, label: 'Votre profil' }, apply);
          return;
        }
        apply();
      },
      addPayment: async (payment) => {
        const id = newId();
        const apply = () => dispatch({ type: 'addPayment', payment: { ...payment, id } });
        if (online) {
          const orgId = await ensureOrganization();
          const tenant = state.tenants.find((t) => t.id === payment.tenantId);
          await write(
            {
              kind: 'createPayment',
              orgId,
              body: {
                id,
                leaseId: payment.tenantId,
                amount: payment.amount,
                method: payment.method,
                period: payment.period,
                receivedAt: payment.date,
              },
              label: `Encaissement de ${formatAmount(payment.amount)}${tenant ? ` (${tenant.firstName} ${tenant.lastName})` : ''}`,
            },
            apply,
          );
          return id;
        }
        apply();
        return id;
      },
      addProperty: async (property, units) => {
        const id = newId();
        const newUnits = toUnits(id, units);
        const apply = () => dispatch({ type: 'addProperty', property: { ...property, id }, units: newUnits });
        if (online) {
          const orgId = await ensureOrganization();
          await write(
            {
              kind: 'createProperty',
              orgId,
              body: {
                id,
                name: property.name,
                type: property.type,
                district: property.district,
                city: property.city,
                description: property.description,
                units: newUnits.map(({ id: unitId, label, rent }) => ({ id: unitId, label, rent })),
              },
              label: `Bien « ${property.name} »`,
            },
            apply,
          );
          return id;
        }
        apply();
        return id;
      },
      addUnits: async (propertyId, units) => {
        const newUnits = toUnits(propertyId, units);
        const apply = () => dispatch({ type: 'addUnits', units: newUnits });
        if (online) {
          const orgId = await ensureOrganization();
          const property = state.properties.find((p) => p.id === propertyId);
          await write(
            {
              kind: 'addUnits',
              orgId,
              propertyId,
              units: newUnits.map(({ id, label, rent }) => ({ id, label, rent })),
              label: `${newUnits.length} unité${newUnits.length > 1 ? 's' : ''}${property ? ` (${property.name})` : ''}`,
            },
            apply,
          );
          return;
        }
        apply();
      },
      addTenant: async ({ rent, advanceMonths, advanceMethod, ...rest }) => {
        const id = newId();
        const now = new Date();
        // L'avance couvre les mois à partir du mois d'entrée (recalculée par le serveur en ligne)
        const entry = rest.entryDate ? new Date(rest.entryDate) : now;
        const payments: Payment[] = advancePeriods(advanceMonths, entry).map((period) => ({
          id: newId(),
          tenantId: id,
          amount: rentForPeriod(rent, period, state.settings.prorata, rest.entryDate).amount,
          method: advanceMethod,
          date: now.toISOString(),
          period,
        }));
        const apply = () =>
          dispatch({ type: 'addTenant', tenant: { ...rest, id, rent, rents: [], advanceMonthsLeft: advanceMonths }, rent, payments });
        if (online) {
          const orgId = await ensureOrganization();
          await write(
            {
              kind: 'createLease',
              orgId,
              body: {
                id,
                unitId: rest.unitId,
                tenant: { firstName: rest.firstName, lastName: rest.lastName, phone: rest.phone },
                rent,
                dueDay: rest.dueDay,
                entryDate: calendarDate(rest.entryDate ?? now.toISOString()),
                endDate: rest.endDate ? calendarDate(rest.endDate) : undefined,
                depositMonths: rest.depositMonths,
                advance: advanceMonths > 0 ? { months: advanceMonths, method: advanceMethod } : undefined,
              },
              localPaymentIds: payments.map((p) => p.id),
              label: `Locataire ${rest.firstName} ${rest.lastName}`,
            },
            apply,
          );
          return id;
        }
        apply();
        return id;
      },
      reviseRent: async ({ tenantId, amount, from, reason, notifyTenant, applyToUnit }) => {
        const tenant = state.tenants.find((t) => t.id === tenantId)!;
        const unit = state.units.find((u) => u.id === tenant.unitId)!;
        const revision: RentRevision = { id: newId(), from, amount, reason };
        // Le loyer d'entrée est figé avant que le logement change de loyer
        const rents = [...(tenant.rents ?? []).filter((r) => r.from !== from), revision].sort((a, b) => a.from.localeCompare(b.from));
        const entryRent = tenant.rent ?? unit.rent;
        const apply = () => {
          dispatch({ type: 'updateTenant', tenantId, patch: { rent: entryRent, rents } });
          // Une unité louée affiche le loyer du mois en cours
          dispatch({ type: 'setUnitRent', unitId: unit.id, rent: rentAt(tenantRent({ ...tenant, rent: entryRent, rents }, unit), periodOf(today)) });
        };
        if (online) {
          const orgId = await ensureOrganization();
          await write(
            {
              kind: 'reviseRent',
              orgId,
              leaseId: tenantId,
              body: { id: revision.id, amount, from, reason, notifyTenant, applyToUnit },
              label: `Révision du loyer de ${tenant.firstName} ${tenant.lastName} (${formatAmount(amount)})`,
            },
            apply,
          );
          return;
        }
        apply();
      },
      cancelRentRevision: async (tenantId, revisionId) => {
        const tenant = state.tenants.find((t) => t.id === tenantId)!;
        const unit = state.units.find((u) => u.id === tenant.unitId)!;
        const rents = (tenant.rents ?? []).filter((r) => r.id !== revisionId);
        const apply = () => {
          dispatch({ type: 'updateTenant', tenantId, patch: { rents } });
          dispatch({ type: 'setUnitRent', unitId: unit.id, rent: rentAt(tenantRent({ ...tenant, rents }, unit), periodOf(today)) });
        };
        if (online) {
          const orgId = await ensureOrganization();
          await write(
            {
              kind: 'cancelRentRevision',
              orgId,
              leaseId: tenantId,
              revisionId,
              label: `Révision du loyer retirée (${tenant.firstName} ${tenant.lastName})`,
            },
            apply,
          );
          return;
        }
        apply();
      },
      setEndDate: async (tenantId, endDate) => {
        const tenant = state.tenants.find((t) => t.id === tenantId)!;
        const apply = () => dispatch({ type: 'updateTenant', tenantId, patch: { endDate: endDate ?? undefined } });
        if (online) {
          const orgId = await ensureOrganization();
          await write(
            {
              kind: 'setEndDate',
              orgId,
              leaseId: tenantId,
              endDate: endDate ? calendarDate(endDate) : null,
              label: `Fin du contrat de ${tenant.firstName} ${tenant.lastName}`,
            },
            apply,
          );
          return;
        }
        apply();
      },
      giveNotice: async (tenantId, notice) => {
        const tenant = state.tenants.find((t) => t.id === tenantId)!;
        const apply = () => dispatch({ type: 'updateTenant', tenantId, patch: { notice } });
        if (online) {
          const orgId = await ensureOrganization();
          await write(
            {
              kind: 'giveNotice',
              orgId,
              leaseId: tenantId,
              body: {
                from: notice.from,
                date: calendarDate(notice.date),
                exitDate: calendarDate(notice.exitDate),
                reason: notice.reason,
              },
              label: `Préavis de ${tenant.firstName} ${tenant.lastName}`,
            },
            apply,
          );
          return;
        }
        apply();
      },
      withdrawNotice: async (tenantId) => {
        const tenant = state.tenants.find((t) => t.id === tenantId)!;
        const apply = () => dispatch({ type: 'updateTenant', tenantId, patch: { notice: undefined } });
        if (online) {
          const orgId = await ensureOrganization();
          await write(
            { kind: 'withdrawNotice', orgId, leaseId: tenantId, label: `Préavis retiré (${tenant.firstName} ${tenant.lastName})` },
            apply,
          );
          return;
        }
        apply();
      },
      voidPayment: async (paymentId, reason) => {
        const apply = () => dispatch({ type: 'removePayment', paymentId });
        if (online) {
          const payment = state.payments.find((p) => p.id === paymentId);
          const orgId = await ensureOrganization();
          await write(
            {
              kind: 'voidPayment',
              orgId,
              paymentId,
              reason,
              label: `Annulation d’un paiement${payment ? ` de ${formatAmount(payment.amount)}` : ''}`,
            },
            apply,
          );
          return;
        }
        apply();
      },
      recordDeparture: async ({ tenantId, exitDate, deductArrears, deductions, refundMethod }) => {
        const tenant = state.tenants.find((t) => t.id === tenantId)!;
        const rent = tenantRent(tenant, state.units.find((u) => u.id === tenant.unitId)!);
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
          addPayments.push({ id: newId(), tenantId, amount, method: 'caution', date: exitDate, period: a.period });
          left -= amount;
        }
        const settlement: Settlement = {
          ...rest,
          arrearsDeducted,
          refundMethod: rest.balance > 0 ? refundMethod : undefined,
        };
        const apply = () =>
          dispatch({
            type: 'recordDeparture',
            tenantId,
            exitDate,
            settlement,
            addPayments,
            // L'avance des mois après le départ est rendue : ces paiements sont annulés
            removePaymentIds: b.prepaidPayments.map((p) => p.id),
          });
        if (online) {
          const orgId = await ensureOrganization();
          // Le serveur recalcule le solde avec ses propres données (règle de prorata de l'espace)
          await write(
            {
              kind: 'recordDeparture',
              orgId,
              leaseId: tenantId,
              body: {
                id: newId(),
                exitDate: calendarDate(exitDate),
                deductArrears,
                deductions,
                refundMethod: settlement.refundMethod,
              },
              localPaymentIds: addPayments.map((p) => p.id),
              label: `Départ de ${tenant.firstName} ${tenant.lastName}`,
            },
            apply,
          );
          return settlement;
        }
        apply();
        return settlement;
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          const schedule = tenantRent(tenant, unit);
          const due = rentForPeriod(schedule, period, settings.prorata, tenant.entryDate).amount;
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
          return { tenant, unit, property, status, paid, due, dueDate: dueDate.toISOString(), rent: rentAt(schedule, period) };
        }),
    [tenants, units, properties, payments, today, period, settings.prorata],
  );
}

export type LeaseAlerts = {
  /** Préavis, fin de contrat proche ou échue, de la plus proche à la plus lointaine */
  ending: { summary: TenantSummary; end: LeaseEnd }[];
  /** Loyer inchangé depuis le nombre de mois réglé */
  revisions: { summary: TenantSummary; since: string }[];
};

/** Alertes « Fin de contrat proche » et « Révision de loyer » de l'accueil. */
export function useLeaseAlerts(): LeaseAlerts {
  const summaries = useTenantSummaries();
  const { today, period, settings } = useStore();
  const rules = settings.leases ?? defaultLeaseSettings;
  return useMemo(() => {
    const day = toCalendar(today.toISOString());
    const ending = summaries
      .map((summary) => {
        const t = summary.tenant;
        const end = leaseEnd(
          {
            endDate: t.endDate ? toCalendar(t.endDate) : null,
            notice: t.notice ? { exitDate: toCalendar(t.notice.exitDate) } : null,
          },
          day,
          rules.leaseEndAlertDays,
        );
        return end ? { summary, end } : null;
      })
      .filter((x): x is { summary: TenantSummary; end: LeaseEnd } => !!x)
      .sort((a, b) => a.end.daysLeft - b.end.daysLeft);
    const revisions = summaries
      // Sans date d'entrée, on ne sait pas depuis quand le loyer n'a pas changé
      .filter((s) => !!s.tenant.entryDate && rentRevisionDue(tenantRent(s.tenant, s.unit), period, rules.rentRevisionAlertMonths))
      .map((summary) => ({ summary, since: lastRentChange(tenantRent(summary.tenant, summary.unit), period) ?? period }))
      .sort((a, b) => a.since.localeCompare(b.since));
    return { ending, revisions };
  }, [summaries, today, period, rules]);
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

/**
 * Ce que le rôle permet dans l'espace ouvert (le serveur vérifie de toute façon). En mode démo ou
 * local, l'utilisateur est propriétaire.
 */
export function usePermissions() {
  const { remote: isRemote, organizations, organizationId } = useStore();
  const role: Role = (isRemote && organizations.find((o) => o.id === organizationId)?.role) || 'owner';
  return {
    role,
    isOwner: role === 'owner',
    /** Biens, locataires, départs, annulations */
    canManage: role === 'owner' || role === 'manager',
    /** Encaisser, relancer, envoyer une quittance */
    canCollect: role !== 'viewer',
    /** Journal d'activité, invitations en attente */
    canAudit: role === 'owner' || role === 'manager',
  };
}

export const roleLabels: Record<Role, string> = {
  owner: 'Propriétaire',
  manager: 'Gérant',
  collector: 'Collecteur',
  viewer: 'Lecteur',
};
