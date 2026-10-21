import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { useStore } from '@/data/store';
import { openNotificationTarget, refreshUnread } from '@/lib/notifications';
import { type PushData, pushSupported, registerForPush } from '@/lib/push';
import { showToast } from '@/lib/toast';

/**
 * Compte en ligne : enregistre le téléphone (si l'autorisation est déjà donnée), affiche les notifications reçues
 * application ouverte, et ouvre le bon écran quand on en touche une (y compris au démarrage), dans le bon espace.
 */
export function PushBridge() {
  const { organizationId, organizations, switchOrganization, refresh } = useStore();
  const current = useRef({ organizationId, organizations, switchOrganization, refresh });
  current.current = { organizationId, organizations, switchOrganization, refresh };

  useEffect(() => {
    if (!pushSupported()) return;
    registerForPush(false).catch(() => {});
    // Autorisation donnée depuis les réglages du téléphone : enregistrement au retour dans l'application
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') registerForPush(false).catch(() => {});
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' || !pushSupported()) return;

    const open = (data: PushData) => openNotificationTarget(data, current.current);

    let handled: string | null = null;
    const respond = (response: Notifications.NotificationResponse | null) => {
      if (!response || response.notification.request.identifier === handled) return;
      handled = response.notification.request.identifier;
      void open((response.notification.request.content.data ?? {}) as PushData);
    };
    // Application lancée en touchant une notification (une fois la navigation prête)
    const coldStart = setTimeout(() => respond(Notifications.getLastNotificationResponse()), 300);
    const tapped = Notifications.addNotificationResponseReceivedListener(respond);
    const received = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body } = notification.request.content;
      showToast(title && body ? `${title} : ${body}` : (body ?? title ?? ''), 'info');
      // Les chiffres de l'écran suivent (paiement reçu, nouveau membre…), et la pastille de la cloche
      current.current.refresh().catch(() => {});
      void refreshUnread();
    });
    return () => {
      clearTimeout(coldStart);
      tapped.remove();
      received.remove();
    };
  }, []);

  return null;
}
