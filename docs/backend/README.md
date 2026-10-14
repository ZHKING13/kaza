# Kaza — backend : dossier de démarrage

> **Code backend : dépôt `zhking13/kaza-api`.** Le schéma de référence y est `apps/api/prisma/schema.prisma`
> (Prisma 7) avec sa migration ; les règles métier partagées y sont publiées en `@zhking13/kaza-domain`.
> Les fichiers `schema.prisma` et `schema.sql` ci-dessous sont la version de conception initiale.

Destiné au développeur backend. Ce dossier fixe les décisions, le modèle de données et le contrat d'API
pour que l'application mobile (déjà fonctionnelle hors ligne) puisse se brancher sur un serveur.

| Fichier | Contenu |
|---|---|
| `README.md` | Décisions, architecture, sécurité, plan de livraison |
| `schema.prisma` | Modèle de données PostgreSQL (validé avec `prisma validate`, Prisma 6.19) |
| `schema.sql` | Migration initiale générée + index partiel et contraintes `CHECK` (exécutée et testée sur PostgreSQL / PGlite) |
| `api.md` | Contrat d'API REST v1, aligné sur les écrans de l'application |

## 1. Décisions

| Sujet | Décision | Pourquoi |
|---|---|---|
| Framework | **NestJS** (projet neuf, léger) | Compétence de l'équipe. |
| Base | **PostgreSQL** + Prisma (`prisma migrate`) | Données relationnelles et financières : clés étrangères, contraintes, transactions, agrégats mensuels. |
| Boilerplate ack | **Socle repris, modules adaptés** | Le socle d'ack (outillage, filtres, middlewares, i18n, clés d'API, santé, couche base de données) est repris dans `kaza-api` et porté sur PostgreSQL. Ses modules métier (auth par e-mail, MongoDB) sont adaptés un par un. Voir § 6 et `apps/api/README.md` de `kaza-api`. |
| Montants | `Int` en francs CFA | Pas de centimes en XOF / XAF ; jamais de `Float` pour de l'argent. |
| Historique | Rien n'est supprimé : paiements annulés (`voidedAt`), biens archivés (`archivedAt`) | Traçabilité face au gérant ; quittances déjà envoyées. |
| Multi-compte | `Organization` + `Membership` (rôles) | Propriétaire seul aujourd'hui, agences et gérants ensuite, sans migration. |
| Locataire / bail | Séparés (`Tenant` / `Lease`) | L'application les confond pour l'instant ; côté serveur, une unité garde l'historique de ses baux. |
| OTP | **Redis** avec durée de vie, pas en base | Données éphémères ; voir § 4. |
| Calculs métier | **Package partagé** `@kaza/domain` (§ 3) | Le prorata, les impayés et le solde de départ doivent donner le même résultat sur le téléphone et sur le serveur. |

## 2. Architecture

```
apps/
  mobile/        ← l'application Expo actuelle
  api/           ← NestJS
packages/
  domain/        ← règles métier en TypeScript pur, sans dépendance
```

Retenu : **deux dépôts**. `kaza-api` (monorepo pnpm : `apps/api` + `packages/domain`) et `loyerflow` (application),
qui installe `@zhking13/kaza-domain` depuis GitHub Packages.

Modules NestJS :

| Module | Rôle |
|---|---|
| `auth` | OTP (WhatsApp / SMS), Google, Apple, JWT, refresh avec rotation |
| `session` | Sessions par appareil, déconnexion à distance |
| `organization` | Organisation, membres, rôles, paramètres (prorata, devise) |
| `property` | Biens et unités |
| `tenant` / `lease` | Locataires, baux, entrée (avance), départ (solde de tout compte) |
| `payment` | Encaissements, annulation, numéros de quittance |
| `dashboard` | Totaux du mois (attendu, encaissé, impayés, vacants) |
| `receipt` | PDF de quittance et de solde (plus tard côté serveur, aujourd'hui généré sur le téléphone) |
| `messaging` | Envoi WhatsApp / SMS (OTP, relances, quittances) via BullMQ |
| `mobile-money` | Webhooks de l'agrégateur (CinetPay, PayDunya…), rapprochement automatique |
| `activity-log` | Journal « qui a fait quoi » |
| `storage` | URLs présignées pour les photos de biens |

Infra minimale du pilote : 1 conteneur API, PostgreSQL managé, Redis managé, stockage objet S3-compatible, Sentry.
Pas de Vault, nginx ni Bull Board au départ.

## 3. Règles métier partagées (`packages/domain`)

Ces fichiers existent déjà dans l'application, en TypeScript sans dépendance à React Native (seulement l'alias `@/` entre eux). Ils ont été vérifiés à la main sur des cas concrets, **pas encore par des tests unitaires** : à écrire en les déplaçant.

| Fichier actuel (`src/…`) | Contenu |
|---|---|
| `data/prorata.ts` | `rentForPeriod` : loyer dû selon la règle (mois complet, au jour près, demi-mois) |
| `data/ledger.ts` | `tenantBalance`, `computeSettlement` : impayés par mois, avance non consommée, solde de départ |
| `lib/words.ts` | Montant en lettres pour les quittances |
| `lib/dates.ts`, `lib/format.ts` (`periodOf`, `formatAmount`) | Périodes `YYYY-MM`, formats FCFA |
| `data/countries.ts` | Indicatifs, longueur des numéros, ville principale |

Les déplacer dans `packages/domain`, les importer depuis l'application **et** l'API. Le serveur recalcule toujours
(il ne fait jamais confiance aux montants envoyés par le téléphone), l'application calcule pour l'affichage hors ligne.

## 4. Authentification

Le téléphone est l'identifiant principal ; l'e-mail est facultatif.

**Code par WhatsApp ou SMS**
1. `POST /v1/auth/otp/send` → code à 6 chiffres, haché (SHA-256 + sel), stocké dans Redis 5 minutes.
2. Limites : 3 envois par numéro / 10 min, 10 par IP / heure, 5 essais par code, puis blocage 15 min.
3. `POST /v1/auth/otp/verify` → crée l'utilisateur au premier passage (`AuthIdentity` provider `phone`), renvoie les jetons et `isNewUser`.
4. Envoi via BullMQ : WhatsApp Cloud API (modèle « authentication ») en premier ; SMS (agrégateur local ou Twilio) si demandé ou en repli après échec.

**Google / Apple** : vérification du jeton côté serveur (repris d'ack, § 6). Un compte créé ainsi doit **vérifier son numéro par code**
avant de pouvoir envoyer des quittances (`POST /v1/me/phone/verify`) : le numéro apparaît sur les documents.

**Jetons** : access JWT ES256 15 min (`sub`, `sessionId`, `jti` ; `orgId` et `role` arriveront avec les organisations),
refresh opaque `sessionId.secret` haché en base (`Session`), rotation à chaque usage, session glissante de 30 jours,
réutilisation d'un ancien refresh = révocation de la session.

## 5. Sécurité et règles d'accès

- Chaque requête métier est filtrée par `organizationId` de la membership active ; jamais d'ID d'organisation pris du corps de requête.
- Rôles : `owner` (tout), `manager` (biens, locataires, encaissements), `collector` (encaisser, consulter), `viewer` (lecture).
  Annuler un paiement ou enregistrer un départ : `owner` ou `manager` uniquement.
- Toute écriture d'argent (paiement, annulation, départ) dans une **transaction** + une ligne `ActivityLog`.
- Idempotence : l'application envoie `Idempotency-Key` sur les `POST` d'argent (elle peut rejouer après une coupure réseau) ;
  la clé est unique en base (`Payment.idempotencyKey`).
- Webhooks mobile money : signature vérifiée, `externalRef` unique (un webhook rejoué ne crée pas de doublon), montant revérifié auprès de l'agrégateur.
- Données personnelles : numéros de téléphone = données à caractère personnel (lois ivoirienne et sénégalaise) ; chiffrement au repos du stockage, export et suppression de compte prévus.

## 6. Ce qu'on reprend d'ack-nestjs-boilerplate (comme référence)

| À reprendre | Où dans ack | Adaptation |
|---|---|---|
| Vérification Google / Apple | `src/modules/auth/domains/auth.social.domain.ts` | Ne plus exiger d'e-mail vérifié pour créer le compte (Apple masque souvent l'e-mail). |
| Sessions et appareils | `src/modules/session`, `src/modules/device` | Refresh haché + rotation. |
| Rôles et permissions | `src/modules/policy` (CASL) | 4 rôles ci-dessus, portée par organisation. |
| Journal d'activité | `src/modules/activity-log` | Table `ActivityLog`. |
| Files d'attente | `src/queues`, BullMQ | Envoi OTP, relances, quittances. |
| Socle | logger pino, Sentry, helmet, throttler, i18n, health, Swagger, clés `x-api-key` | **Fait** : repris dans `kaza-api` (PostgreSQL, messages en français). |

À ne pas reprendre : MongoDB et ses `ObjectId`, `username`, historique et expiration des mots de passe, 2FA TOTP,
conditions d'utilisation versionnées, feature flags, import/export, géolocalisation IP, Vault.

## 7. Brancher l'application

**Fait** (voir le README de l'application, « Connexion au serveur ») :

- `src/lib/auth.ts` : `apiAuth` appelle `/api/v1/public/auth/*` ; les écrans de connexion n'ont presque pas changé.
- `src/data/store.tsx` : cache local relu au démarrage puis remplacé par `GET …/snapshot` ; écritures envoyées au serveur
  (avec `Idempotency-Key` pour les locataires et les encaissements) avant de modifier le téléphone.

- File d'envoi hors ligne : écritures gardées sur le téléphone et rejouées au retour du réseau ; identifiants choisis par
  l'application (UUID) et acceptés par l'API, donc rejeu sans doublon.

Reste : départ et solde côté serveur, photos (stockage objet), connexion Google / Apple dans l'application.

## 8. Plan de livraison

| Étape | Contenu | Résultat |
|---|---|---|
| 1 | Projet NestJS, Prisma, migration `schema.sql`, `packages/domain`, CI (lint, typecheck, tests) — **fait** | Base qui démarre |
| 2 | Auth : OTP WhatsApp / SMS, Google, Apple, sessions ; preuve d'intégrité de l'application — **fait**, branché dans l'application (Google / Apple : boutons à brancher) | Connexion réelle |
| 3 | Organisation, biens, unités, locataires, baux (entrée avec avance), file d'envoi hors ligne — **fait** (photos : à faire) | Données sauvegardées sur le serveur |
| 4 | Paiements, annulation, tableau de bord, départ et solde — **fait** | Parcours complet synchronisé |
| 5 | Relances, quittances PDF, bienvenue et solde envoyés par WhatsApp (BullMQ, repli SMS) — **fait** (modèles WhatsApp à faire approuver par Meta) | Moins de gestes pour le bailleur |
| 6 | Mobile money : liens de paiement, interface commune d'agrégateur, rapprochement (webhook et passage régulier) — **fait** avec un agrégateur de test ; reste à brancher l'agrégateur choisi et les reversements | Paiement par lien |
| 7 | Gérants et agences : invitations par numéro, rôles, plusieurs espaces par compte, journal d'activité — **fait** (modèle WhatsApp `kaza_invitation` à faire approuver) | Offre Pro / Agence |

Tests à écrire en priorité : règles de `packages/domain` (prorata, solde de départ), contraintes d'accès par organisation,
idempotence des paiements, rejeu de webhook.
