# Kaza — contrat d'API v1

Base : `/api/v1` (socle repris d'ack-nestjs-boilerplate dans `kaza-api`). JSON. Dates ISO 8601 ; périodes au format `YYYY-MM` ;
montants en francs CFA entiers.
Toute requête porte `x-api-key: <key>:<secret>` (clé de l'application, type `default`).
Authentification : `Authorization: Bearer <access token>` en plus, sauf mention « public ».
Réponses au format ack : `{ statusCode, message, metadata, data }` ; langue des messages : français par défaut, `x-custom-lang: en` sinon.
Les écritures d'argent acceptent `Idempotency-Key: <uuid>` (rejeu sans doublon).

Erreurs : `{ "statusCode": 5xxxx, "statusCodeKey": "otpInvalid", "module": "auth", "message": "Code incorrect.", "metadata": {…} }`
(messages en français, prêts à afficher). Les codes d'erreur ci-dessous correspondent à `statusCodeKey`.

## Authentification — **implémentée** (`kaza-api`, étape 2)

| Méthode | Route | Corps | Réponse `data` | Écran |
|---|---|---|---|---|
| POST | `/public/auth/otp/send` | `{ phone: "+2250712345678", channel?: "whatsapp" \| "sms" }` | `{ channel, resendInSeconds: 30, expiresInSeconds: 300 }` | Connexion |
| POST | `/public/auth/otp/verify` | `{ phone, code, device?: { name?, platform?: "ios" \| "android" \| "web" } }` | `Login` | Code |
| POST | `/public/auth/social/google` | `{ device? }` + `Authorization: Bearer <id token Google>` | `Login` | Connexion |
| POST | `/public/auth/social/apple` | `{ firstName?, lastName?, device? }` + `Authorization: Bearer <identity token Apple>` | `Login` | Connexion (iOS) |
| POST | `/public/auth/refresh` | `{ refreshToken }` | `Tokens` | — |
| POST | `/user/auth/logout` | — (jeton d'accès) | — | Plus › Se déconnecter |

`Tokens = { tokenType: "Bearer", accessToken, expiresIn: 900, refreshToken, refreshTokenExpiresAt }`
`Login = Tokens & { isNewUser, user }`

- Le jeton de rafraîchissement est **à usage unique** : enregistrer le nouveau avant toute autre requête, ne jamais lancer
  deux rafraîchissements en parallèle. Rejouer un ancien jeton révoque la session (il est considéré comme volé).
- Après un rafraîchissement, l'ancien jeton d'accès est refusé : rejouer la requête avec le nouveau.
- La session expire après 30 jours **sans utilisation** (chaque rafraîchissement la prolonge).
- Code : 30 s entre deux envois, 3 codes par numéro / 10 min, 10 par IP / heure, 5 essais puis blocage 15 min.

Codes d'erreur (`statusCodeKey`) : `otpInvalid` (avec `data.remainingAttempts`), `otpExpired`, `otpTooManyAttempts` et
`otpRateLimited` (avec `data.retryAfterSeconds`), `phoneInvalid`, `socialGoogleInvalid`, `socialAppleInvalid`,
`jwtAccessTokenInvalid` (jeton d'accès absent ou expiré : rafraîchir), `forbidden` (session révoquée : reconnecter).

## Profil et organisation

| Méthode | Route | Corps / paramètres | Réponse | Écran |
|---|---|---|---|---|
| GET | `/user/me` | — | `user` (**implémenté** ; `organizations` viendra à l'étape 3) | Démarrage |
| PATCH | `/user/me` | `{ firstName, lastName }` | `user` (**implémenté**) | Onboarding › Profil |
| POST | `/me/phone/otp` | `{ phone, channel }` | `{ resendIn }` | Profil (compte Google / Apple) |
| POST | `/me/phone/verify` | `{ phone, code }` | `user` | idem |
| POST | `/organizations` | `{ name, countryCode }` | `organization` | fin d'onboarding (créée automatiquement au premier bien si absente) |
| PATCH | `/organizations/:id` | `{ prorataRule?, name? }` | `organization` | Paramètres |
| GET | `/organizations/:id/onboarding` | — | `{ hasProperty, hasTenant, hasPayment }` | Liste « Pour bien démarrer » |

Les routes suivantes sont préfixées par `/organizations/:orgId` (abrégé `…`).

## Biens et unités

| Méthode | Route | Corps / paramètres | Réponse | Écran |
|---|---|---|---|---|
| GET | `…/properties` | `?filter=late\|vacant&q=` | `[PropertySummary]` | Biens |
| POST | `…/properties` | `{ name, type, district, city, description?, photoKey?, units: [{ label, rent }] }` | `property` | Nouveau bien, onboarding |
| GET | `…/properties/:id` | `?period=2026-10` | `PropertyDetail` (unités avec bail actif et statut du mois) | Fiche bien |
| PATCH | `…/properties/:id` | champs du bien | `property` | — |
| POST | `…/properties/:id/units` | `{ units: [{ label, rent }] }` | `[unit]` | Ajouter des unités |
| POST | `…/uploads/property-photo` | `{ contentType }` | `{ uploadUrl, photoKey }` (URL présignée) | Photo du bien |

`PropertySummary = { id, name, type, district, city, photoUrl?, unitCount, occupancy, expected, collected, lateCount, vacantCount }`

Pour une villa ou un magasin, l'application envoie une seule unité (`label` « Maison » ou « Local »).

## Locataires et baux

| Méthode | Route | Corps / paramètres | Réponse | Écran |
|---|---|---|---|---|
| GET | `…/leases` | `?status=active\|ended&rentStatus=late\|partial\|upcoming\|paid&q=` | `[LeaseSummary]` | Locataires |
| POST | `…/leases` | voir ci-dessous | `{ lease, tenant, payments }` | Nouveau locataire |
| GET | `…/leases/:id` | — | `LeaseDetail` (+ paiements, solde si terminé) | Fiche locataire |
| GET | `…/leases/:id/settlement-preview` | `?exitDate=&deductArrears=true&deductions=` | `SettlementPreview` | Départ (aperçu en direct) |
| POST | `…/leases/:id/departure` | `{ exitDate, deductArrears, deductions: [{ label, amount }], refundMethod? }` | `settlement` | Départ |

Corps de `POST …/leases` (une seule transaction : locataire, bail, paiements d'avance, journal) :

```json
{
  "unitId": "…",
  "tenant": { "firstName": "Awa", "lastName": "Koné", "phone": "+2250712345678" },
  "rent": 85000,
  "dueDay": 5,
  "entryDate": "2026-10-20",
  "depositMonths": 2,
  "advance": { "months": 3, "method": "wave" }
}
```

Le serveur calcule les montants de l'avance avec `rentForPeriod` (règle de prorata de l'organisation) ; il ignore tout montant envoyé.

`LeaseSummary = { id, tenant: { id, firstName, lastName, phone }, unit: { id, label }, property: { id, name }, rent, dueDate, period, due, paid, status }`
avec `status` ∈ `paid | partial | late | upcoming` pour la période demandée (par défaut le mois en cours).

Erreurs : `UNIT_NOT_VACANT`, `LEASE_ALREADY_ENDED`, `EXIT_BEFORE_ENTRY`.

## Paiements

| Méthode | Route | Corps / paramètres | Réponse | Écran |
|---|---|---|---|---|
| GET | `…/payments` | `?period=2026-10&leaseId=&cursor=` | `{ items: [Payment], nextCursor }` | Paiements, historique |
| POST | `…/payments` | `{ leaseId, amount, method, period, receivedAt }` + `Idempotency-Key` | `Payment` | Encaisser |
| POST | `…/payments/:id/void` | `{ reason }` | `Payment` | (à venir) annuler une saisie |
| GET | `…/payments/:id/receipt` | — | `ReceiptData` (quittance ou reçu partiel) | Quittance |

`Payment = { id, leaseId, amount, method, source, period, receivedAt, receiptNumber, voidedAt? }`

`ReceiptData = { kind: "quittance" | "recu_partiel", receiptNumber, landlord, tenant, unit, property, period, amount, amountInWords, dueForPeriod, paidForPeriod, method, receivedAt }`
— l'application continue de produire le PDF ; un rendu PDF serveur (`Accept: application/pdf`) pourra venir ensuite pour l'envoi automatique.

Erreurs : `AMOUNT_INVALID`, `PERIOD_BEFORE_ENTRY`, `PERIOD_AFTER_EXIT`, `IDEMPOTENCY_CONFLICT`.

## Tableau de bord

| Méthode | Route | Paramètres | Réponse | Écran |
|---|---|---|---|---|
| GET | `…/dashboard` | `?period=2026-10` | `{ expected, collected, outstanding, lateCount, paidCount, tenantCount, vacantCount, recentPayments: [Payment] }` | Accueil |

## Webhooks (public, signés)

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/webhooks/mobile-money/:provider` | Confirmation de paiement de l'agrégateur → `Payment` source `mobile_money`, `externalRef` unique |
| POST | `/webhooks/messaging/:provider` | Statut de livraison WhatsApp / SMS → `Reminder.status` |
