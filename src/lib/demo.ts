import { router } from 'expo-router';
import { Platform } from 'react-native';

/**
 * Démo web du site vitrine (`EXPO_PUBLIC_WEB_DEMO=1`) : la démo s'ouvre directement et « Créer mon compte » mène à
 * l'inscription sur le site (`EXPO_PUBLIC_WEB_DEMO_SIGNUP`, par défaut /fondateurs).
 */
export const isWebDemo = Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_DEMO === '1';
const webDemoSignup = process.env.EXPO_PUBLIC_WEB_DEMO_SIGNUP || '/fondateurs?utm_source=demo';

/** Libellé du bouton de la bannière de démo */
export const demoSignupLabel = isWebDemo ? 'Réserver ma place' : 'Créer mon compte';

/** Quitte la démo et ouvre directement la connexion pour créer un vrai compte. */
export function createAccountFromDemo(signOut: () => void) {
  if (isWebDemo) {
    // La démo peut être affichée dans un cadre du site : on ouvre l'inscription sur la page entière
    (window.top ?? window).location.href = webDemoSignup;
    return;
  }
  signOut();
  // Laisse le routeur basculer sur les écrans « non connecté » avant d'ouvrir la connexion
  setTimeout(() => router.push('/connexion'), 50);
}
