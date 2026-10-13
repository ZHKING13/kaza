# Kaza

Application mobile de gestion locative pour les propriétaires et petites agences d'Afrique francophone :
encaissement des loyers (espèces, Orange Money, MTN MoMo, Wave, Moov), suivi des impayés,
relances et quittances sur WhatsApp.

> Version 0.1 : application fonctionnelle **sans serveur**. Les données sont enregistrées sur le téléphone
> (AsyncStorage). La connexion tourne en **mode démo** (`src/lib/auth.ts`) : aucun SMS ni message WhatsApp
> n'est envoyé, le code s'affiche à l'écran, et Google / Apple renvoient un compte fictif.
> « Explorer la démo » charge des biens et locataires d'exemple (`src/data/mock.ts`).

## Brancher la vraie connexion

`src/lib/auth.ts` définit l'interface `AuthProvider` (`sendOtp`, `verifyOtp`, `signInWithGoogle`, `signInWithApple`).
Remplacer `demoAuth` par une implémentation reliée au backend (par exemple Supabase : OTP par SMS ou WhatsApp,
`signInWithIdToken` pour Google et Apple). Les écrans n'ont pas à changer.

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
