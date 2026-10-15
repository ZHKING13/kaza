import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from './api';
import { isApiConfigured } from './config';

/**
 * Notifications push (service d'Expo : FCM sur Android, APNs sur iOS).
 *
 * Le téléphone s'enregistre auprès du serveur Kaza à chaque démarrage, une fois l'autorisation donnée ; le serveur envoie
 * les notifications selon le rôle de chacun dans l'espace et ses réglages (Paramètres › Notifications).
 * Il faut un build de développement ou de production (pas Expo Go) et l'identifiant du projet EAS (`extra.eas.projectId`).
 */

const TOKEN_KEY = 'kaza.pushToken';

export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

/** Où mène une notification touchée (champ `data`, voir l'API). */
export type PushData = {
  screen?: 'tenant' | 'late' | 'subscription' | 'team' | string;
  organizationId?: string;
  leaseId?: string;
  paymentId?: string;
};

export const pushCategories = ['payments', 'late', 'lease', 'subscription', 'team', 'teamPayments'] as const;
export type PushCategory = (typeof pushCategories)[number];
export type PushSettings = Record<PushCategory, boolean> & { devices: number };

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}

/** Un vrai téléphone, un compte en ligne et un projet EAS : sinon rien n'est demandé ni envoyé. */
export function pushSupported(): boolean {
  return isApiConfigured && Platform.OS !== 'web' && Device.isDevice && !!projectId();
}

if (Platform.OS !== 'web') {
  // Application ouverte : pas de bannière système, l'application affiche son propre message (voir usePushNotifications)
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function pushPermission(): Promise<PushPermission> {
  if (!pushSupported()) return 'unsupported';
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  return status === 'denied' && !canAskAgain ? 'denied' : 'undetermined';
}

/**
 * Enregistre ce téléphone. `ask` : demande l'autorisation si elle n'a pas encore été donnée (sinon, rien n'est demandé).
 * Renvoie l'autorisation obtenue.
 */
export async function registerForPush(ask = false): Promise<PushPermission> {
  if (!pushSupported()) return 'unsupported';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Kaza',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#0F766E',
    });
  }
  let permission = await pushPermission();
  if (permission !== 'granted' && ask) {
    const { status } = await Notifications.requestPermissionsAsync();
    permission = status === 'granted' ? 'granted' : 'denied';
  }
  if (permission !== 'granted') return permission;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
  await api.post('/user/me/push-devices', {
    token,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    appVersion: Constants.expoConfig?.version,
  });
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return 'granted';
}

/** Déconnexion : ce téléphone ne reçoit plus les notifications du compte (appelé avant de fermer la session). */
export async function unregisterPush(): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  if (!token) return;
  await api.post('/user/me/push-devices/remove', { token }).catch(() => {});
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
}

export const pushApi = {
  settings: () => api.get<PushSettings>('/user/me/notification-settings'),
  update: (changes: Partial<Record<PushCategory, boolean>>) => api.patch<PushSettings>('/user/me/notification-settings', changes),
};
