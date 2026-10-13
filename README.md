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
| `src/data/outbox.ts` | File d'envoi : écritures en attente, envoi, erreurs à réessayer ou refusées |
| `src/components/SyncBanner.tsx` | Bannière : enregistrements en attente d'envoi, enregistrements refusés |
| `src/data/store.tsx` | Cache local : relu au démarrage, puis mis à jour depuis le serveur ; chaque écriture passe d'abord par le serveur |

Fonctionnement en mode serveur :
- **Démarrage** : l'application s'ouvre sur les données du téléphone, puis se met à jour depuis le serveur (lecture hors ligne possible).
- **Écritures** (espace, bien, unités, locataire, encaissement, annulation d'un paiement, départ, profil, règle de prorata) : avec du réseau, envoyées tout
  de suite ; le téléphone n'est modifié qu'une fois l'écriture acceptée, et un refus (unité déjà louée…) s'affiche dans
  le formulaire.
- **Sans réseau** (ou serveur indisponible) : l'écriture est faite sur le téléphone et mise dans la **file d'envoi**
  (`src/data/outbox.ts`), gardée même si l'application est fermée. Elle part dans l'ordre au retour du réseau : nouvel
  essai après 5 s, 10 s, 20 s… (2 min au plus), au retour dans l'application, ou avec « Réessayer maintenant ».
  - Les identifiants (bien, unités, locataire, paiement, solde de départ) sont choisis par le téléphone (UUID) et repris par le serveur :
    rejouer un envoi dont la réponse s'est perdue renvoie l'existant, sans doublon. Le numéro de quittance d'un paiement
    saisi hors ligne ne change pas.
  - Écriture refusée au moment de l'envoi (par exemple une unité louée entre-temps depuis un autre téléphone) : retirée
    de la file, signalée par une bannière, et le téléphone reprend les données du serveur.
  - Tant que la file n'est pas vide, les données du serveur ne remplacent pas celles du téléphone.
  - « Se déconnecter » prévient si des enregistrements n'ont pas encore été envoyés.
- **Montants** : l'avance d'un nouveau locataire et le solde de départ sont recalculés par le serveur (règle de
  prorata de l'espace). Au départ, le téléphone affiche tout de suite son propre calcul, puis reprend celui du serveur :
  impayés réglés par la caution, avance des mois suivants annulée.
- **Annuler un paiement** : depuis la quittance (« Annuler ce paiement », avec un motif), pour le propriétaire et le
  gérant. Impossible pour un locataire parti ou une retenue sur caution.
- **Session** : expirée ou révoquée → retour à l'écran de connexion. « Se déconnecter » révoque la session sur le serveur.
- **Pas encore** en mode serveur : photos des biens (gardées sur le téléphone), connexion Google / Apple (boutons
  masqués), quittance produite par le serveur.

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
