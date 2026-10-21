const fs = require('node:fs');

/**
 * Complète app.json au moment du build.
 * - google-services.json (Firebase, notifications Android) n'est pas versionné : sur EAS, il vient de la variable
 *   de type fichier GOOGLE_SERVICES_JSON ; en local, du fichier à la racine s'il existe.
 * - EXPO_BASE_URL : sous-dossier du site web (ex. /demo pour la démo publiée sur le site vitrine).
 */
module.exports = ({ config }) => {
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON || (fs.existsSync('./google-services.json') ? './google-services.json' : undefined);

  return {
    ...config,
    ...(process.env.EXPO_BASE_URL ? { experiments: { ...config.experiments, baseUrl: process.env.EXPO_BASE_URL } } : {}),
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
