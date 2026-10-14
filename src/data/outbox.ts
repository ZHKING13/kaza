import { ApiError } from '@/lib/api';

import type { ProrataRule } from './prorata';
import {
  type DepartureBody,
  type LeaseBody,
  type MessagingSettings,
  type PaymentBody,
  type PropertyBody,
  remote,
  type UnitBody,
} from './remote';
import type { Payment, Settlement } from './types';

/**
 * File d'envoi : écritures faites sans réseau (ou pendant qu'une panne serveur dure), gardées sur le
 * téléphone et rejouées dans l'ordre au retour du réseau.
 *
 * Chaque création porte l'identifiant choisi par l'application (UUID) et une clé Idempotency-Key fixée
 * à la mise en file : si un envoi atteint le serveur mais que la réponse se perd, le rejeu renvoie
 * l'enregistrement déjà créé au lieu d'en créer un second.
 */
export type OutboxOp =
  | { kind: 'createOrganization'; body: { id: string; name: string; countryCode: string }; prorataRule?: ProrataRule }
  | { kind: 'updateProfile'; body: { firstName: string; lastName: string } }
  | {
      kind: 'updateOrganization';
      orgId: string;
      body: { prorataRule?: ProrataRule; messaging?: Partial<MessagingSettings> };
    }
  | { kind: 'createProperty'; orgId: string; body: PropertyBody }
  | { kind: 'addUnits'; orgId: string; propertyId: string; units: UnitBody[] }
  /** `localPaymentIds` : avance calculée sur le téléphone, remplacée par celle du serveur après l'envoi */
  | { kind: 'createLease'; orgId: string; body: LeaseBody; localPaymentIds: string[] }
  | { kind: 'createPayment'; orgId: string; body: PaymentBody }
  | { kind: 'voidPayment'; orgId: string; paymentId: string; reason: string }
  /** `localPaymentIds` : retenues sur caution calculées sur le téléphone, remplacées par celles du serveur */
  | { kind: 'recordDeparture'; orgId: string; leaseId: string; body: DepartureBody; localPaymentIds: string[] };

export type OutboxEntry = OutboxOp & {
  /** Clé Idempotency-Key, identique à chaque tentative */
  key: string;
  /** Description pour l'utilisateur : « Encaissement de 85 000 FCFA (Awa Koné) » */
  label: string;
  createdAt: string;
  attempts: number;
};

/** Écriture à envoyer, avant sa mise en file */
export type OutboxDraft = OutboxOp & { label: string };

export type OutboxFailure = { key: string; label: string; message: string; at: string };

/** Ce que l'envoi renvoie d'utile au téléphone */
export type OutboxResult =
  | { kind: 'lease'; leaseId: string; payments: Payment[]; localPaymentIds: string[] }
  | { kind: 'departure'; leaseId: string; settlement: Settlement; payments: Payment[]; localPaymentIds: string[]; voidedPaymentIds: string[] }
  | { kind: 'organization'; messaging?: MessagingSettings }
  | { kind: 'done' };

export async function sendOutboxEntry(entry: OutboxEntry): Promise<OutboxResult> {
  switch (entry.kind) {
    case 'createOrganization': {
      const organization = await remote.createOrganization(entry.body);
      if (entry.prorataRule && entry.prorataRule !== organization.prorataRule) {
        await remote.updateOrganization(organization.id, { prorataRule: entry.prorataRule });
      }
      return { kind: 'organization', messaging: organization.messaging };
    }
    case 'updateProfile':
      await remote.updateProfile(entry.body.firstName, entry.body.lastName);
      return { kind: 'done' };
    case 'updateOrganization': {
      const organization = await remote.updateOrganization(entry.orgId, entry.body);
      return { kind: 'organization', messaging: organization.messaging };
    }
    case 'createProperty':
      await remote.createProperty(entry.orgId, entry.body);
      return { kind: 'done' };
    case 'addUnits':
      await remote.addUnits(entry.orgId, entry.propertyId, entry.units);
      return { kind: 'done' };
    case 'createLease': {
      const res = await remote.createLease(entry.orgId, entry.body, entry.key);
      return { kind: 'lease', leaseId: res.leaseId, payments: res.payments, localPaymentIds: entry.localPaymentIds };
    }
    case 'createPayment':
      await remote.createPayment(entry.orgId, entry.body, entry.key);
      return { kind: 'done' };
    case 'voidPayment':
      await remote.voidPayment(entry.orgId, entry.paymentId, entry.reason);
      return { kind: 'done' };
    case 'recordDeparture': {
      const res = await remote.departure(entry.orgId, entry.leaseId, entry.body);
      return { kind: 'departure', leaseId: entry.leaseId, localPaymentIds: entry.localPaymentIds, ...res };
    }
  }
}

/**
 * Vrai si l'écriture peut réussir plus tard : pas de réseau, serveur en panne ou surchargé.
 * Faux si le serveur l'a refusée (données invalides, unité déjà louée…) : la rejouer ne changerait rien.
 */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return error.key === 'network' || error.status >= 500 || error.status === 429 || error.status === 408;
}

/** Délai avant la prochaine tentative : 5 s, 10 s, 20 s… plafonné à 2 min. */
export function retryDelay(attempts: number): number {
  return Math.min(5000 * 2 ** Math.max(attempts - 1, 0), 120000);
}
