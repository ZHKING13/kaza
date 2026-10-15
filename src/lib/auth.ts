import { Platform } from 'react-native';

import { ApiError, api, saveTokens, type Tokens } from './api';
import { isApiConfigured } from './config';
import { integrityOutcome, prepareProof } from './integrity';
import { unregisterPush } from './push';
import { tokens } from './tokens';
import type { ApiUser } from '@/data/remote';

/**
 * Authentification de Kaza.
 *
 * - `apiAuth` : serveur Kaza (code par WhatsApp ou SMS, sessions). Utilisé dès que
 *   EXPO_PUBLIC_API_URL et EXPO_PUBLIC_API_KEY sont définis (voir lib/config.ts).
 * - `demoAuth` : MODE DÉMO, aucun message n'est envoyé ; le code à saisir est affiché à l'écran.
 *
 * Google et Apple : le serveur sait vérifier leurs jetons ; il reste à obtenir ces jetons dans
 * l'application (Google Sign-In, Sign in with Apple), d'où `socialAvailable` à faux en mode serveur.
 */

export type OtpChannel = 'whatsapp' | 'sms';

export type OtpRequest = {
  phone: string;
  channel: OtpChannel;
  /** Secondes avant de pouvoir redemander un code */
  resendIn: number;
  /** Mode démo uniquement : le code à saisir */
  demoCode?: string;
};

export type SocialIdentity = { provider: 'google' | 'apple'; email?: string; firstName?: string; lastName?: string };

export type VerifyResult =
  | { ok: true; isNewUser: boolean; user?: ApiUser }
  | { ok: false; message: string };

export interface AuthProvider {
  readonly isDemo: boolean;
  /** Boutons Google / Apple proposés */
  readonly socialAvailable: boolean;
  /** Erreurs avec un message prêt à afficher (`ApiError`) */
  sendOtp(phone: string, channel: OtpChannel): Promise<OtpRequest>;
  verifyOtp(phone: string, code: string): Promise<VerifyResult>;
  signInWithGoogle(): Promise<SocialIdentity>;
  signInWithApple(): Promise<SocialIdentity>;
}

const pending = new Map<string, string>();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const demoAuth: AuthProvider = {
  isDemo: true,
  socialAvailable: true,
  async sendOtp(phone, channel) {
    await wait(500);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    pending.set(phone, code);
    return { phone, channel, resendIn: 30, demoCode: code };
  },
  async verifyOtp(phone, code) {
    await wait(400);
    return pending.get(phone) === code
      ? { ok: true, isNewUser: true }
      : { ok: false, message: 'Code incorrect. Vérifiez les 6 chiffres et réessayez.' };
  },
  async signInWithGoogle() {
    await wait(500);
    return { provider: 'google', email: 'demo.google@kaza.africa' };
  },
  async signInWithApple() {
    await wait(500);
    return { provider: 'apple', email: 'demo.apple@kaza.africa' };
  },
};

type LoginResponse = Tokens & { isNewUser: boolean; user: ApiUser };

export const apiAuth: AuthProvider = {
  isDemo: false,
  socialAvailable: false,
  async sendOtp(phone, channel) {
    // Preuve d'intégrité jointe quand la plateforme sait en produire (voir lib/integrity.ts).
    // Clé App Attest inconnue du serveur (application réinstallée, base vidée) : une nouvelle clé, un essai de plus.
    for (let attempt = 0; ; attempt++) {
      const proof = await prepareProof('otp-send', phone);
      try {
        const res = await api.post<{ channel: OtpChannel; resendInSeconds: number }>(
          '/public/auth/otp/send',
          { phone, channel, ...(proof ? { integrity: proof.body } : {}) },
          { auth: false },
        );
        await proof?.settle('accepted');
        return { phone, channel, resendIn: res.resendInSeconds };
      } catch (error) {
        const outcome = integrityOutcome(error);
        await proof?.settle(outcome);
        if (outcome === 'keyUnknown' && attempt === 0) continue;
        throw error;
      }
    }
  },
  async verifyOtp(phone, code) {
    try {
      const res = await api.post<LoginResponse>(
        '/public/auth/otp/verify',
        { phone, code, device: { platform: deviceKind() } },
        { auth: false },
      );
      await saveTokens(res);
      return { ok: true, isNewUser: res.isNewUser, user: res.user };
    } catch (error) {
      if (error instanceof ApiError && error.key !== 'network' && error.status < 500) {
        return { ok: false, message: error.message };
      }
      throw error;
    }
  },
  async signInWithGoogle() {
    throw new Error('La connexion Google n’est pas encore disponible.');
  },
  async signInWithApple() {
    throw new Error('La connexion Apple n’est pas encore disponible.');
  },
};

function deviceKind(): 'ios' | 'android' | 'web' {
  return Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
}

/** Ferme la session sur le serveur (si possible) puis oublie les jetons du téléphone. */
export async function endSession(): Promise<void> {
  if (isApiConfigured && (tokens.getAccess() || (await tokens.getRefresh()))) {
    // Avant la fermeture de la session : la requête a besoin du jeton
    await unregisterPush();
    await api.post('/user/auth/logout', {}).catch(() => {});
  }
  await tokens.clear();
}

export const auth: AuthProvider = isApiConfigured ? apiAuth : demoAuth;
