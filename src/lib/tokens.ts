import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Jetons de session. Le jeton d'accès (15 min) reste en mémoire ; le jeton de rafraîchissement
 * (à usage unique, renouvelé à chaque utilisation) est gardé dans le stockage sécurisé du téléphone
 * (Keychain / Keystore). Sur le web, à défaut, dans le localStorage.
 */
const REFRESH_KEY = 'kaza.refreshToken';

let accessToken: string | null = null;

const web = Platform.OS === 'web';

export const tokens = {
  getAccess: () => accessToken,
  setAccess: (value: string | null) => {
    accessToken = value;
  },
  async getRefresh(): Promise<string | null> {
    if (web) return globalThis.localStorage?.getItem(REFRESH_KEY) ?? null;
    return SecureStore.getItemAsync(REFRESH_KEY);
  },
  async setRefresh(value: string | null): Promise<void> {
    if (web) {
      if (value) globalThis.localStorage?.setItem(REFRESH_KEY, value);
      else globalThis.localStorage?.removeItem(REFRESH_KEY);
      return;
    }
    if (value) await SecureStore.setItemAsync(REFRESH_KEY, value);
    else await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
  async clear(): Promise<void> {
    accessToken = null;
    await this.setRefresh(null);
  },
};
