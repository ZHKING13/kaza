const fs = require('node:fs');

/**
 * Complète app.json au moment du build.
 * - google-services.json (Firebase, notifications Android) n'est pas versionné : sur EAS, il vient de la variable
 *   de type fichier GOOGLE_SERVICES_JSON, copiée à la racine ; en local, du fichier à la racine s'il existe.
 * - EXPO_BASE_URL : sous-dossier du site web (ex. /demo pour la démo publiée sur le site vitrine).
 */
module.exports = ({ config }) => {
  // Sur EAS, le fichier secret est déposé à un chemin qui change d'une machine à l'autre : copié à la racine, son chemin
  // reste le même, et la version d'exécution (empreinte) du build et des mises à jour aussi.
  if (process.env.GOOGLE_SERVICES_JSON && fs.existsSync(process.env.GOOGLE_SERVICES_JSON)) {
    fs.copyFileSync(process.env.GOOGLE_SERVICES_JSON, './google-services.json');
  }
  const googleServicesFile = fs.existsSync('./google-services.json') ? './google-services.json' : undefined;

  return {
    ...config,
    ...(process.env.EXPO_BASE_URL ? { experiments: { ...config.experiments, baseUrl: process.env.EXPO_BASE_URL } } : {}),
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
