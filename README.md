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
- **Envoi du code** : une preuve que la demande vient de la vraie application est jointe (Play Integrity sur Android,
  App Attest sur iOS, `src/lib/integrity.ts`). Le serveur l'exige ou non selon son mode ; sur le web, ou sur un
  appareil qui ne sait pas en produire (simulateur iOS, Android sans Google Play), la demande part sans.
  Android : renseigner `EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT_NUMBER`. iOS : capacité App Attest déclarée dans `app.json`.
  La clé `x-api-key` identifie l'application auprès du serveur mais n'est pas un secret.
- **Messages aux locataires** (étape 5) : dans Paramètres, relances automatiques (rappel avant l'échéance, relance
  de retard) et envoi automatique des quittances, du message de bienvenue et du solde de départ. Sur la fiche
  locataire : « Envoyer une relance par Kaza » et la liste des messages envoyés (reçu, lu, échec) ; sur la
  quittance : « Envoyer la quittance par Kaza » (PDF produit par le serveur). Le bouton WhatsApp ouvre toujours
  l'application WhatsApp du bailleur pour un message personnel.
- **Équipe** (étape 7) : Plus › Équipe et gérants. Le propriétaire invite par numéro (gérant, collecteur, lecteur),
  change les rôles, retire un membre ; la personne invitée voit l'invitation en se connectant (avant de créer son
  propre espace, ou sur l'accueil) et la rejoint ou la refuse. Un membre peut quitter l'espace. Les boutons suivent
  le rôle (un collecteur encaisse et relance, mais n'ajoute ni bien ni locataire, n'enregistre pas de départ et
  n'annule pas de paiement ; un lecteur consulte). Plus › Journal d'activité (propriétaire, gérant) : qui a fait quoi.
- **Plusieurs espaces** : son propre espace et ceux où l'on a été invité ; changement dans l'onglet Plus (refusé tant
  que des enregistrements hors ligne attendent d'être envoyés). Rôles et invitations sont relus à l'ouverture de
  l'application : un membre retiré quitte l'espace sur son téléphone.
- **Paiement en ligne** (étape 6) : sur la fiche locataire, « Envoyer un lien de paiement » (le reste du mois) part
  sur le WhatsApp du locataire, qui paie par Wave, Orange Money, MTN ou Moov chez l'agrégateur. Le paiement
  s'enregistre tout seul (« payé en ligne » dans l'historique, quittance si les messages automatiques sont activés) ;
  la fiche se met à jour d'elle-même tant qu'un lien attend. Liens en attente annulables. Visible si le serveur a un
  agrégateur configuré ; en développement, l'agrégateur de test ouvre une page de paiement simulée.
- **Cycle de vie du bail** (étape 8) : sur la fiche, une section « Bail » (loyer et révision prévue, fin du contrat,
  préavis). « Réviser le loyer » : nouveau montant à partir d'un mois (au plus tôt le mois en cours), historique des
  montants, révision prévue annulable, message WhatsApp au locataire (case cochée par défaut). Les mois passés gardent
  leur loyer ; la caution du solde de départ reste celle versée à l'entrée. « Fin du contrat et préavis » : date de
  fin (ou durée indéterminée, prolonger d'un an), préavis du locataire ou du bailleur (départ prévu calculé avec la
  durée de l'espace, modifiable), retrait du préavis ; le départ reprend la date prévue. Kaza enregistre le préavis
  sans le signifier au locataire. Accueil : cartes « Fin de contrat proche » (préavis ou fin dans les 60 jours,
  contrat échu) et « Révision de loyer » (loyer inchangé depuis 12 mois). Paramètres › Préavis et alertes.
  Propriétaire et gérant ; fonctionne hors ligne (file d'envoi). Durée du contrat choisie à l'ajout du locataire.
- **Identité et quittances** (étape 9) : Plus › Identité et quittances (propriétaire ; les autres rôles consultent).
  Raison sociale, adresse, téléphone et e-mail affichés, RCCM, numéro fiscal, couleur (8 au choix), logo, signature
  ou cachet (image), phrase en pied de quittance, avec un aperçu en direct et une quittance d'exemple en PDF. La
  quittance, le reçu partiel et le solde de tout compte de l'application, ainsi que le PDF envoyé par WhatsApp, prennent
  cette identité ; sans réglage, ils restent comme avant. Logo et cachet sont gardés sur le téléphone (quittances hors ligne).
- **Photos des biens** : réduites et compressées sur le téléphone, envoyées au serveur (file d'envoi hors ligne),
  visibles par toute l'équipe et sur un autre téléphone ; « Changer la photo » sur la fiche du bien (propriétaire,
  gérant). Les photos prises avant cette version sont envoyées à la prochaine connexion.
- **Offres** (étape 10) : Gratuit (3 logements), Bailleur (3 000 FCFA/mois, 10 logements, messages Kaza, liens de
  paiement), Pro (8 000, 40 logements, équipe de 3, quittances à vos couleurs, journal), Agence (25 000, 150 logements,
  équipe illimitée) ; 12 mois au prix de 10. Essai Pro de 30 jours à la création de l'espace, 7 jours de grâce après
  l'échéance, puis offre gratuite sans rien effacer (consulter, encaisser, imprimer restent possibles). Plus › Mon offre :
  usage (logements, équipe, messages du mois), choix de l'offre et de la durée, paiement par mobile money (page de
  l'agrégateur, l'offre se met à jour d'elle-même), factures PDF. Le paiement est suivi même si l'on quitte l'écran ou l'application : un message bref confirme l'offre
  dès que le paiement est reçu (et une notification push si l'application est fermée). Quand le serveur refuse une action pour cause d'offre,
  une fenêtre propose l'offre qui la permet. Bandeau sur l'accueil : fin d'essai proche, offre échue, limites dépassées.
- **Notifications push** (étape 11, téléphones Android et iOS, compte en ligne) : paiement en ligne reçu, récapitulatif
  des loyers en retard à 9 h, fin de contrat et préavis à J-30, J-7 et le jour J, offre payée ou bientôt échue, membre qui
  rejoint l'espace, encaissements de l'équipe (désactivés par défaut). Destinataires selon le rôle dans l'espace. Carte
  « Activer les notifications » sur l'accueil (une fois ; « Plus tard » la masque), réglages par type dans Paramètres ›
  Mes notifications. Application ouverte : un message bref et les chiffres se mettent à jour ; notification touchée :
  le bon écran s'ouvre (fiche du locataire, retards, Mon offre, Équipe), dans le bon espace. La déconnexion arrête les
  notifications sur ce téléphone. Prérequis : un build EAS (pas Expo Go) et `extra.eas.projectId` dans `app.json`
  (voir « Notifications push » ci-dessous) ; sans eux, rien n'est demandé.
- **Dépenses** (étape 12) : fiche du bien › Dépenses (propriétaire, gérant ; les autres rôles consultent). Montant,
  catégorie (travaux, entretien, charges, impôt foncier, assurance, gardiennage, frais d'agence, autre), date, unité
  facultative, moyen de paiement, fournisseur, note, photo du justificatif. « Répéter chaque mois » : la même dépense
  revient chaque mois le même jour (créée par le serveur, ou par le téléphone sans compte en ligne), modifiable puis
  arrêtable. Encaissé, dépenses et net du mois et de l'année sur la fiche ; « Dépenses du mois » et net sur l'accueil.
  Annulation avec motif. Hors ligne : file d'envoi comme pour les paiements.
- **Propriétaire du bien (mandant)** : pour une agence, sur la fiche du bien, nom, numéro et commission de gestion (%).
- **Rapports et exports** (Plus › Rapports et exports) : relevé de gestion (période : ce mois, mois dernier, 3 derniers
  mois, cette année, année dernière ; tous les biens ou certains) en PDF aux couleurs de l'espace, et en Excel (synthèse,
  mois par mois, paiements, dépenses ; à partir de l'offre Bailleur). Compte rendu par propriétaire (Pro, Agence) :
  encaissé − commission − dépenses = montant dû, loyers encaissés, dépenses, mois par mois ; résumé envoyé par WhatsApp.
  Calcul partagé avec l'API (`buildReport`, domaine 0.7.0), sur le téléphone, hors ligne compris.
- **Mises à jour sans passer par les stores** (EAS Update) : la nouvelle version se télécharge en arrière-plan et
  s'applique au démarrage suivant ; une version importante propose « Redémarrer » (voir « Publier une mise à jour »).
- **Session** : expirée ou révoquée → retour à l'écran de connexion. « Se déconnecter » révoque la session sur le serveur.
- **Pas encore** en mode serveur : connexion Google / Apple (boutons masqués).

## Notifications push : mise en place

1. Compte Expo, puis `npx eas init` : ajoute `extra.eas.projectId` à `app.json` (l'application lit cet identifiant).
2. Android : projet Firebase, application `africa.kaza.app`, clé de compte de service FCM v1 envoyée à Expo
   (`eas credentials` › Android › Push Notifications).
3. iOS : compte Apple Developer ; `eas build` crée la clé APNs et le profil avec l'autorisation « Push Notifications ».
4. Serveur : `PUSH_PROVIDER=expo` (défaut en production) ; `EXPO_ACCESS_TOKEN` seulement si la « sécurité renforcée »
   des notifications est activée sur le projet Expo.
5. Build de développement (`eas build --profile development`) pour essayer : Expo Go ne reçoit pas ces notifications.

## Publier une mise à jour (EAS Update)

1. Une fois : `npx eas init` (identifiant du projet), puis `npx eas update:configure` (ajoute `updates.url` à `app.json`).
2. Builds avec un canal : `eas build --profile preview` (tests, canal `preview`) ou `--profile production`.
3. Publier : `eas update --channel preview --message "…"`, puis `--channel production` une fois vérifié.
4. Correction importante (le téléphone propose de redémarrer tout de suite) : augmenter `extra.updateCriticalIndex`
   dans `app.json` avant `eas update`.
5. Revenir en arrière : `eas update:rollback`. Les versions ne vont qu'aux builds de même empreinte native
   (`runtimeVersion: fingerprint`) : un nouveau module natif ou une nouvelle permission demande un nouveau build store.

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
