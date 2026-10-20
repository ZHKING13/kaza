import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { api, errorMessage } from './api';
import type { PushCategory, PushData } from './push';
import { showToast } from './toast';

/** Notification du centre de notifications (la cloche), gardée 90 jours sur le serveur. */
export type AppNotification = {
  id: string;
  organizationId: string | null;
  category: PushCategory;
  title: string;
  body: string;
  data: PushData;
  readAt: string | null;
  createdAt: string;
};

type Page = { items: AppNotification[]; unread: number; hasMore: boolean };

export const notificationsApi = {
  list: (before?: string) =>
    api.get<Page>(`/user/me/notifications?limit=30${before ? `&before=${encodeURIComponent(before)}` : ''}`),
  read: (ids?: string[]) => api.post<{ unread: number }>('/user/me/notifications/read', ids ? { ids } : {}),
};

// Nombre de non-lues partagé par la cloche de l'accueil et l'écran Notifications
let unread = 0;
const listeners = new Set<(n: number) => void>();

export function setUnread(n: number): void {
  unread = n;
  for (const l of listeners) l(n);
}

/** Relit le nombre de non-lues (sans effet en cas d'erreur réseau). */
export async function refreshUnread(): Promise<void> {
  try {
    const page = await api.get<Page>('/user/me/notifications?limit=1');
    setUnread(page.unread);
  } catch {
    // Hors connexion : la pastille garde sa dernière valeur
  }
}

// Démo : trois notifications d'exemple, non lues jusqu'à l'ouverture de la cloche
let demoStarted = false;

/** Pastille selon le compte : démo (exemples), en ligne (serveur), sur ce téléphone seulement (aucune). */
export function syncUnread(mode: 'demo' | 'real', online: boolean): void {
  if (mode === 'demo') {
    if (!demoStarted) {
      demoStarted = true;
      setUnread(3);
    }
    return;
  }
  demoStarted = false;
  if (online) void refreshUnread();
  else setUnread(0);
}

export function useUnreadNotifications(): number {
  const [n, setN] = useState(unread);
  useEffect(() => {
    listeners.add(setN);
    setN(unread);
    return () => {
      listeners.delete(setN);
    };
  }, []);
  return n;
}

type Workspace = {
  organizationId: string | null;
  organizations: { id: string }[];
  switchOrganization: (id: string) => Promise<void>;
};

/** Ouvre l'écran d'une notification (push touché ou ligne du centre), en passant d'abord dans le bon espace. */
export async function openNotificationTarget(data: PushData, workspace: Workspace): Promise<void> {
  if (data.organizationId && data.organizationId !== workspace.organizationId) {
    if (!workspace.organizations.some((o) => o.id === data.organizationId)) {
      showToast('Vous ne faites plus partie de cet espace.', 'info');
      return;
    }
    try {
      await workspace.switchOrganization(data.organizationId);
    } catch (error) {
      showToast(errorMessage(error), 'error');
      return;
    }
  }
  switch (data.screen) {
    case 'tenant':
      if (data.leaseId) router.push({ pathname: '/locataire/[id]', params: { id: data.leaseId } });
      break;
    case 'late':
      router.navigate({ pathname: '/locataires', params: { filtre: 'late' } });
      break;
    case 'receipt':
      if (data.paymentId) router.push({ pathname: '/quittance/[id]', params: { id: data.paymentId } });
      break;
    case 'subscription':
      router.push('/offre');
      break;
    case 'team':
      router.push('/equipe');
      break;
    case 'declarations':
      router.push('/declarations');
      break;
  }
}
