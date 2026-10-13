/**
 * Connexion au serveur Kaza (dépôt `kaza-api`).
 *
 * Variables lues au moment du build (Expo les intègre au bundle) :
 * - EXPO_PUBLIC_API_URL : ex. https://api.kaza.app ou http://192.168.1.10:3000 en développement
 * - EXPO_PUBLIC_API_KEY : clé `x-api-key` de l'application (type « default », créée par `pnpm db:seed`).
 *   Elle identifie l'application auprès du serveur mais n'est pas secrète (lisible dans le paquet installé).
 * - EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT_NUMBER : projet Google Cloud lié à l'application dans la Play Console,
 *   pour les jetons Play Integrity (voir lib/integrity.ts). Vide : pas de preuve d'intégrité sur Android.
 *
 * Sans ces variables, l'application reste en mode local : données sur le téléphone, code de démo.
 */
export const apiConfig = {
  url: (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, ''),
  key: process.env.EXPO_PUBLIC_API_KEY ?? '',
};

export const isApiConfigured = !!apiConfig.url && !!apiConfig.key;

export const integrityConfig = {
  googleCloudProjectNumber: process.env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT_NUMBER ?? '',
};
