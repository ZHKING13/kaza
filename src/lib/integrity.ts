import * as AppIntegrity from '@expo/app-integrity';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { ApiError, api } from './api';
import { integrityConfig } from './config';

/**
 * Preuve que la demande vient de la vraie application (Play Integrity sur Android, App Attest
 * sur iOS), exigée par le serveur avant d'envoyer un code (voir kaza-api, `app-integrity`).
 *
 * 1. Défi à usage unique demandé au serveur.
 * 2. Preuve liée à `<action>:<défi>:<sujet>` (ex. `otp-send:<défi>:+2250712345678`).
 * 3. Si la plateforme ne sait pas produire de preuve (web, simulateur, pas de Google Play…),
 *    la demande part sans : c'est le serveur qui décide selon son mode (off, report, enforce).
 */

export type IntegrityAction = 'otp-send';

export type IntegrityProof =
  | { platform: 'android'; challenge: string; token: string }
  | { platform: 'ios'; challenge: string; keyId: string; attestation?: string; assertion?: string };

export type IntegrityOutcome = 'accepted' | 'keyUnknown' | 'failed';

export type PreparedProof = {
  body: IntegrityProof;
  /** À appeler avec le résultat de la requête : garde ou oublie la clé App Attest. */
  settle(outcome: IntegrityOutcome): Promise<void>;
};

const KEY_ID = 'kaza.appAttest.keyId';
const KEY_ATTESTED = 'kaza.appAttest.attested';

let androidProvider: Promise<void> | null = null;

/** Prépare le fournisseur de jetons Play Integrity (lent la première fois) ; sans effet ailleurs. */
export function prepareIntegrity(): Promise<void> {
  if (Platform.OS !== 'android' || !integrityConfig.googleCloudProjectNumber) return Promise.resolve();
  androidProvider ??= AppIntegrity.prepareIntegrityTokenProviderAsync(integrityConfig.googleCloudProjectNumber).catch(
    (error: unknown) => {
      androidProvider = null;
      throw error;
    },
  );
  return androidProvider;
}

async function challenge(): Promise<string> {
  const res = await api.post<{ challenge: string }>('/public/app-integrity/challenge', {}, { auth: false });
  return res.challenge;
}

const clientData = (action: IntegrityAction, value: string, subject: string) => `${action}:${value}:${subject}`;

async function androidProof(action: IntegrityAction, subject: string): Promise<PreparedProof | null> {
  if (!integrityConfig.googleCloudProjectNumber) return null;
  try {
    await prepareIntegrity();
  } catch {
    return null;
  }
  const value = await challenge();
  const requestHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    clientData(action, value, subject),
    { encoding: Crypto.CryptoEncoding.HEX },
  );
  let token: string;
  try {
    token = await AppIntegrity.requestIntegrityCheckAsync(requestHash);
  } catch (error) {
    // Fournisseur expiré : on le refait une fois.
    if ((error as { code?: string }).code !== 'ERR_APP_INTEGRITY_PROVIDER_INVALID') return null;
    androidProvider = null;
    try {
      await prepareIntegrity();
      token = await AppIntegrity.requestIntegrityCheckAsync(requestHash);
    } catch {
      return null;
    }
  }
  return { body: { platform: 'android', challenge: value, token }, settle: async () => {} };
}

async function forgetKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_ID).catch(() => {});
  await SecureStore.deleteItemAsync(KEY_ATTESTED).catch(() => {});
}

async function iosProof(action: IntegrityAction, subject: string): Promise<PreparedProof | null> {
  if (!AppIntegrity.isSupported) return null;
  try {
    let keyId = await SecureStore.getItemAsync(KEY_ID);
    if (!keyId) {
      keyId = await AppIntegrity.generateKeyAsync();
      await SecureStore.setItemAsync(KEY_ID, keyId);
      await SecureStore.deleteItemAsync(KEY_ATTESTED);
    }
    const attested = (await SecureStore.getItemAsync(KEY_ATTESTED)) === '1';
    const value = await challenge();
    const data = clientData(action, value, subject);

    if (attested) {
      const assertion = await AppIntegrity.generateAssertionAsync(keyId, data);
      return {
        body: { platform: 'ios', challenge: value, keyId, assertion },
        settle: async (outcome) => {
          if (outcome === 'keyUnknown') await forgetKey();
        },
      };
    }

    let attestation: string;
    try {
      attestation = await AppIntegrity.attestKeyAsync(keyId, data);
    } catch (error) {
      // Apple indisponible : même clé plus tard ; toute autre erreur : nouvelle clé.
      if ((error as { code?: string }).code !== 'ERR_APP_INTEGRITY_SERVER_UNAVAILABLE') await forgetKey();
      return null;
    }
    return {
      body: { platform: 'ios', challenge: value, keyId, attestation },
      settle: async (outcome) => {
        // Une clé ne s'atteste qu'une fois : si le serveur ne l'a pas gardée, on en refera une.
        if (outcome === 'accepted') await SecureStore.setItemAsync(KEY_ATTESTED, '1');
        else await forgetKey();
      },
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    return null;
  }
}

/** Preuve pour une action, ou `null` si la plateforme n'en produit pas. Les erreurs réseau remontent. */
export async function prepareProof(action: IntegrityAction, subject: string): Promise<PreparedProof | null> {
  if (Platform.OS === 'android') return androidProof(action, subject);
  if (Platform.OS === 'ios') return iosProof(action, subject);
  return null;
}

/** Ce que le résultat d'une requête protégée dit de la preuve envoyée. */
export function integrityOutcome(error: unknown): IntegrityOutcome {
  if (!error) return 'accepted';
  if (error instanceof ApiError) {
    if (error.key === 'integrityKeyUnknown') return 'keyUnknown';
    // Trop de codes demandés : refusé après la vérification de la preuve, donc preuve acceptée.
    if (error.key === 'otpRateLimited' || error.key === 'otpTooManyAttempts') return 'accepted';
  }
  return 'failed';
}
