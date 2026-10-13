import { router } from 'expo-router';

/** Quitte la démo et ouvre directement la connexion pour créer un vrai compte. */
export function createAccountFromDemo(signOut: () => void) {
  signOut();
  // Laisse le routeur basculer sur les écrans « non connecté » avant d'ouvrir la connexion
  setTimeout(() => router.push('/connexion'), 50);
}
