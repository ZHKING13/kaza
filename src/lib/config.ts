/**
 * Connexion au serveur Kaza (dépôt `kaza-api`).
 *
 * Variables lues au moment du build (Expo les intègre au bundle) :
 * - EXPO_PUBLIC_API_URL : ex. https://api.kaza.app ou http://192.168.1.10:3000 en développement
 * - EXPO_PUBLIC_API_KEY : clé `x-api-key` de l'application (type « default », créée par `pnpm db:seed`)
 *
 * Sans ces variables, l'application reste en mode local : données sur le téléphone, code de démo.
 */
export const apiConfig = {
  url: (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, ''),
  key: process.env.EXPO_PUBLIC_API_KEY ?? '',
};

export const isApiConfigured = !!apiConfig.url && !!apiConfig.key;
