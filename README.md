# Kaza

Application mobile de gestion locative pour les propriétaires et petites agences d'Afrique francophone :
encaissement des loyers (espèces, Orange Money, MTN MoMo, Wave, Moov), suivi des impayés,
relances et quittances sur WhatsApp.

> Deux modes, choisis au build par les variables `EXPO_PUBLIC_API_URL` et `EXPO_PUBLIC_API_KEY` (voir `.env.example`) :
> - **Serveur Kaza** (dépôt `kaza-api`) : connexion par code WhatsApp ou SMS, données enregistrées sur le compte
>   et retrouvées sur un autre téléphone ;
> - **Local** (variables absentes) : données sur le téléphone (AsyncStorage), connexion en mode démo
>   (le code s'affiche à l'écran, Google / Apple renvoient un compte fictif).
>
> « Explorer la démo » charge des biens et locataires d'exemple (`src/data/mock.ts`) dans les deux modes.

## Connexion au serveur

```bash
cp .env.example .env      # adresse de l'API et clé de l'application
npx expo start --clear    # --clear à chaque changement de .env
```

| Fichier | Rôle |
|---|---|
| `src/lib/config.ts` | Lit l'adresse et la clé ; `isApiConfigured` choisit le mode |
| `src/lib/api.ts` | Client HTTP : clé `x-api-key`, jeton d'accès, renouvellement automatique (un seul à la fois), messages d'erreur du serveur |
| `src/lib/tokens.ts` | Jeton de rafraîchissement dans le stockage sécurisé du téléphone (`expo-secure-store`), jeton d'accès en mémoire |
| `src/lib/auth.ts` | `apiAuth` (code par WhatsApp / SMS) ou `demoAuth` |
| `src/data/remote.ts` | Appels de l'API et conversion du « snapshot » du serveur vers le modèle de l'application |
| `src/data/store.tsx` | Cache local : relu au démarrage, puis mis à jour depuis le serveur ; chaque écriture passe d'abord par le serveur |

Fonctionnement en mode serveur :
- **Démarrage** : l'application s'ouvre sur les données du téléphone, puis se met à jour depuis le serveur (lecture hors ligne possible).
- **Écritures** (bien, unités, locataire, encaissement, profil, règle de prorata) : envoyées au serveur avec `Idempotency-Key`
  pour les locataires et les encaissements ; le téléphone n'est modifié qu'une fois l'écriture acceptée. Sans réseau,
  l'écran affiche « Pas de connexion » et rien n'est perdu de ce qui est déjà enregistré.
- **Montants** : l'avance d'un nouveau locataire est calculée par le serveur (règle de prorata de l'espace).
- **Session** : expirée ou révoquée → retour à l'écran de connexion. « Se déconnecter » révoque la session sur le serveur.
- **Pas encore** en mode serveur : départ d'un locataire et solde (le serveur arrive à l'étape 4), photos des biens
  (gardées sur le téléphone), connexion Google / Apple (boutons masqués), écritures hors ligne mises en file d'attente.

## Lancer l'application

```bash
npm install
npx expo start        # puis scanner le QR code avec Expo Go (Android / iOS)
npx expo start --web  # aperçu dans le navigateur
```

Vérifications avant chaque commit :

```bash
npm run typecheck
```

## Organisation

| Dossier | Contenu |
|---|---|
| `src/app/` | Écrans (Expo Router) : `(tabs)/` pour les 5 onglets, `bien/`, `locataire/[id].tsx`, `encaisser.tsx` |
| `src/components/` | Composants d'interface (Text, Button, Card, StatusBadge, TenantRow, Fab…) |
| `src/theme/` | Tokens du design system et `useTheme()` (mode clair et sombre) |
| `src/data/` | Types, données d'exemple et store en mémoire |
| `src/lib/` | Formats locaux (FCFA, dates, téléphones) et liens WhatsApp |
| `design-system/kaza/MASTER.md` | Spécification du design system |
| `docs/brand-guidelines.md` | Charte de marque (nom, logo, ton) |
| `docs/backend/` | Dossier backend : décisions, schéma PostgreSQL (Prisma + SQL), contrat d'API |
| `assets/` | Icônes de l'application, splash, logos (`assets/brand/`) |

## Écrans disponibles

- **Accueil et connexion** : écran de bienvenue, numéro + code par WhatsApp ou SMS (6 chiffres, renvoi après 30 s), Google, Apple, ou démo
- **Onboarding** : profil (nom sur les quittances), premier bien ; l'Accueil guide ensuite vers l'ajout des locataires
- **Déconnexion** (Plus) : efface les données du téléphone après confirmation

- **Quittances PDF** : quittance (loyer payé en entier) ou reçu de paiement partiel, montant en lettres, partage WhatsApp ; solde de tout compte en PDF au départ

- **Paramètres** : règle des mois incomplets (mois complet, au jour près, demi-mois), appliquée au loyer du mois, à l'avance et au solde de départ

- **Accueil** : encaissé du mois, impayés, lots vacants, relance groupée, paiements récents
- **Biens** : encaissé du mois par bien, retards, unités vacantes ; filtres « Avec impayés » et « Unités vacantes »
- **Fiche bien** : photo ou illustration, encaissé / attendu / occupation, onglets Unités, Locataires, Historique
- **Nouveau bien** : nom, type, quartier et ville, loyer (villa, magasin) ou liste d'unités avec « Dupliquer », photo facultative
- **Paiements** : historique groupé par mois
- **Locataires** : recherche et filtres par statut (En retard, Partiel, À venir, Payé)
- **Nouveau locataire** : unité vacante, import depuis les contacts, indicatif pays, loyer, date d'entrée (calendrier), jour de paiement, avance (loyers payés à partir du mois d'entrée) et caution, message de bienvenue WhatsApp
- **Fiche locataire** : appel, relance WhatsApp, situation du mois, caution, historique, départ
- **Départ** : date de départ, impayés jusqu'au mois du départ (retenus ou non sur la caution), retenues (réparations, factures…), solde de tout compte à rembourser ou à réclamer, envoi sur WhatsApp ; l'unité redevient vacante et le locataire passe dans « Anciens »
- **Encaisser** : choix du locataire, montant, mode de paiement, puis quittance WhatsApp
