import { useCallback, useEffect, useState } from 'react';

import { errorMessage } from '@/lib/api';
import { isApiConfigured } from '@/lib/config';

import { remote, type TenantMessage, type TenantMessageKind, type TenantMessageStatus } from './remote';
import { useStore } from './store';

/**
 * Messages envoyés aux locataires par le serveur (WhatsApp, repli SMS) : relances, quittances,
 * bienvenue, solde de départ. Lecture et envoi demandent le réseau ; rien n'est mis en file d'attente
 * (une relance partie des heures plus tard surprendrait le locataire).
 */

export const messageKindLabels: Record<TenantMessageKind, string> = {
  rent_due_soon: 'Rappel avant l’échéance',
  rent_late: 'Relance de retard',
  rent_manual: 'Relance',
  receipt: 'Quittance',
  welcome: 'Message de bienvenue',
  settlement: 'Solde de tout compte',
  payment_link: 'Lien de paiement',
  rent_revision: 'Révision du loyer',
};

export const messageStatusLabels: Record<TenantMessageStatus, string> = {
  queued: 'En cours d’envoi',
  sent: 'Envoyé',
  delivered: 'Reçu',
  read: 'Lu',
  failed: 'Échec',
  cancelled: 'Annulé',
};

/** Le compte peut-il faire envoyer des messages par Kaza ? (mode serveur, espace créé) */
export function useServerMessaging(): { enabled: boolean; organizationId: string | null } {
  const { remote: isRemote, organizationId } = useStore();
  return { enabled: isRemote && isApiConfigured && !!organizationId, organizationId };
}

/** Un autre écran vient de faire envoyer un message (lien de paiement…) : les listes se rechargent. */
const listeners = new Set<() => void>();
export function notifyMessagesChanged(): void {
  // Le message part par la file du serveur : on laisse le temps de l'envoyer
  setTimeout(() => listeners.forEach((l) => l()), 1500);
}

export function useTenantMessages(leaseId: string | undefined) {
  const { enabled, organizationId } = useServerMessaging();
  const [messages, setMessages] = useState<TenantMessage[] | null>(null);
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    if (!enabled || !organizationId || !leaseId) return;
    try {
      setMessages(await remote.messages(organizationId, leaseId));
      setError(undefined);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [enabled, organizationId, leaseId]);

  useEffect(() => {
    void reload();
    const listener = () => void reload();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [reload]);

  return { enabled, messages, error, reload };
}
