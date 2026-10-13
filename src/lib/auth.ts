/**
 * Authentification de Kaza.
 *
 * Cette version tourne en MODE DÉMO : aucun SMS ni message WhatsApp n'est envoyé et Google / Apple
 * ne sont pas contactés. Le code à saisir est affiché à l'écran. Pour passer en production, remplacer
 * `demoAuth` par une implémentation de `AuthProvider` branchée sur le backend (par exemple Supabase :
 * OTP par SMS ou WhatsApp, `signInWithIdToken` pour Google et Apple).
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

export interface AuthProvider {
  readonly isDemo: boolean;
  sendOtp(phone: string, channel: OtpChannel): Promise<OtpRequest>;
  verifyOtp(phone: string, code: string): Promise<boolean>;
  signInWithGoogle(): Promise<SocialIdentity>;
  signInWithApple(): Promise<SocialIdentity>;
}

const pending = new Map<string, string>();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const demoAuth: AuthProvider = {
  isDemo: true,
  async sendOtp(phone, channel) {
    await wait(500);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    pending.set(phone, code);
    return { phone, channel, resendIn: 30, demoCode: code };
  },
  async verifyOtp(phone, code) {
    await wait(400);
    return pending.get(phone) === code;
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

export const auth: AuthProvider = demoAuth;
