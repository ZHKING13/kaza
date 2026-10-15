import { api } from './api';

/**
 * Web : pas de notifications push (réservées aux téléphones, voir push.native.ts). Les réglages du compte
 * restent modifiables, ils valent pour les téléphones de l'utilisateur.
 */
export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export type PushData = {
  screen?: 'tenant' | 'late' | 'subscription' | 'team' | string;
  organizationId?: string;
  leaseId?: string;
  paymentId?: string;
};

export const pushCategories = ['payments', 'late', 'lease', 'subscription', 'team', 'teamPayments'] as const;
export type PushCategory = (typeof pushCategories)[number];
export type PushSettings = Record<PushCategory, boolean> & { devices: number };

export function pushSupported(): boolean {
  return false;
}

export async function pushPermission(): Promise<PushPermission> {
  return 'unsupported';
}

export async function registerForPush(_ask = false): Promise<PushPermission> {
  return 'unsupported';
}

export async function unregisterPush(): Promise<void> {}

export const pushApi = {
  settings: () => api.get<PushSettings>('/user/me/notification-settings'),
  update: (changes: Partial<Record<PushCategory, boolean>>) => api.patch<PushSettings>('/user/me/notification-settings', changes),
};
