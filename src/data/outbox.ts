import { ApiError } from '@/lib/api';

import type { ProrataRule } from './prorata';
import type { LeaseSettings } from './rent';
import {
  type ApiOrganization,
  type AllocationBody,
  type DepartureBody,
  type ExpenseBody,
  type ExpenseUpdateBody,
  type IdentityFields,
  type ImageTarget,
  type LandlordBody,
  type LeaseBody,
  type MessagingSettings,
  type NoticeBody,
  type PaymentBody,
  type PropertyBody,
  remote,
  type RentRevisionBody,
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
      body: { prorataRule?: ProrataRule; messaging?: Partial<MessagingSettings>; leases?: Partial<LeaseSettings> };
    }
  | { kind: 'createProperty'; orgId: string; body: PropertyBody }
  | { kind: 'addUnits'; orgId: string; propertyId: string; units: UnitBody[] }
  /** `localPaymentIds` : avance calculée sur le téléphone, remplacée par celle du serveur après l'envoi */
  | { kind: 'createLease'; orgId: string; body: LeaseBody; localPaymentIds: string[] }
  | { kind: 'createPayment'; orgId: string; body: PaymentBody }
  /** Encaissement sur plusieurs mois ; `localPaymentIds` : répartition calculée sur le téléphone, remplacée par celle du serveur */
  | { kind: 'allocatePayment'; orgId: string; body: AllocationBody; localPaymentIds: string[] }
  | { kind: 'voidPayment'; orgId: string; paymentId: string; reason: string }
  /** `localPaymentIds` : retenues sur caution calculées sur le téléphone, remplacées par celles du serveur */
  | { kind: 'recordDeparture'; orgId: string; leaseId: string; body: DepartureBody; localPaymentIds: string[] }
  | { kind: 'reviseRent'; orgId: string; leaseId: string; body: RentRevisionBody }
  | { kind: 'cancelRentRevision'; orgId: string; leaseId: string; revisionId: string }
  | { kind: 'setEndDate'; orgId: string; leaseId: string; endDate: string | null }
  | { kind: 'giveNotice'; orgId: string; leaseId: string; body: NoticeBody }
  | { kind: 'withdrawNotice'; orgId: string; leaseId: string }
  | { kind: 'updateIdentity'; orgId: string; body: Partial<IdentityFields> }
  /** `uri` : image compressée (data URI) ou fichier local */
  | { kind: 'putImage'; orgId: string; target: ImageTarget; propertyId?: string; uri: string }
  | { kind: 'deleteImage'; orgId: string; target: ImageTarget; propertyId?: string }
  | { kind: 'createExpense'; orgId: string; body: ExpenseBody }
  | { kind: 'updateExpense'; orgId: string; expenseId: string; body: ExpenseUpdateBody }
  | { kind: 'voidExpense'; orgId: string; expenseId: string; reason: string }
  | { kind: 'stopExpenseSchedule'; orgId: string; scheduleId: string }
  | { kind: 'updateLandlord'; orgId: string; propertyId: string; body: LandlordBody };

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
  | { kind: 'organization'; organization: ApiOrganization }
  | { kind: 'done' };

export async function sendOutboxEntry(entry: OutboxEntry): Promise<OutboxResult> {
  switch (entry.kind) {
    case 'createOrganization': {
      const organization = await remote.createOrganization(entry.body);
      if (entry.prorataRule && entry.prorataRule !== organization.prorataRule) {
        await remote.updateOrganization(organization.id, { prorataRule: entry.prorataRule });
      }
      return { kind: 'organization', organization };
    }
    case 'updateProfile':
      await remote.updateProfile(entry.body.firstName, entry.body.lastName);
      return { kind: 'done' };
    case 'updateOrganization': {
      const organization = await remote.updateOrganization(entry.orgId, entry.body);
      return { kind: 'organization', organization };
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
    case 'allocatePayment': {
      const payments = await remote.allocatePayment(entry.orgId, entry.body, entry.key);
      return { kind: 'lease', leaseId: entry.body.leaseId, payments, localPaymentIds: entry.localPaymentIds };
    }
    case 'voidPayment':
      await remote.voidPayment(entry.orgId, entry.paymentId, entry.reason);
      return { kind: 'done' };
    case 'recordDeparture': {
      const res = await remote.departure(entry.orgId, entry.leaseId, entry.body);
      return { kind: 'departure', leaseId: entry.leaseId, localPaymentIds: entry.localPaymentIds, ...res };
    }
    case 'reviseRent':
      await remote.reviseRent(entry.orgId, entry.leaseId, entry.body);
      return { kind: 'done' };
    case 'cancelRentRevision':
      await remote.cancelRentRevision(entry.orgId, entry.leaseId, entry.revisionId);
      return { kind: 'done' };
    case 'setEndDate':
      await remote.setEndDate(entry.orgId, entry.leaseId, entry.endDate);
      return { kind: 'done' };
    case 'giveNotice':
      await remote.giveNotice(entry.orgId, entry.leaseId, entry.body);
      return { kind: 'done' };
    case 'withdrawNotice':
      await remote.withdrawNotice(entry.orgId, entry.leaseId);
      return { kind: 'done' };
    case 'updateIdentity':
      await remote.updateIdentity(entry.orgId, entry.body);
      return { kind: 'done' };
    case 'putImage':
      await remote.putImage(entry.orgId, entry.target, entry.uri, entry.propertyId);
      return { kind: 'done' };
    case 'deleteImage':
      await remote.deleteImage(entry.orgId, entry.target, entry.propertyId);
      return { kind: 'done' };
    case 'createExpense':
      await remote.createExpense(entry.orgId, entry.body);
      return { kind: 'done' };
    case 'updateExpense':
      await remote.updateExpense(entry.orgId, entry.expenseId, entry.body);
      return { kind: 'done' };
    case 'voidExpense':
      await remote.voidExpense(entry.orgId, entry.expenseId, entry.reason);
      return { kind: 'done' };
    case 'stopExpenseSchedule':
      await remote.stopExpenseSchedule(entry.orgId, entry.scheduleId);
      return { kind: 'done' };
    case 'updateLandlord':
      await remote.updateLandlord(entry.orgId, entry.propertyId, entry.body);
      return { kind: 'done' };
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
