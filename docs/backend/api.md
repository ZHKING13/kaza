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

## Profil et organisation — **implémenté** (étape 3)

| Méthode | Route | Corps / paramètres | Réponse `data` | Écran |
|---|---|---|---|---|
| GET | `/user/me` | — | `{ user, organizations: [Organization] }` | Démarrage |
| PATCH | `/user/me` | `{ firstName, lastName }` | `user` | Onboarding › Profil |
| POST | `/user/organizations` | `{ name, countryCode, type? }` | `Organization` (créateur = `owner`) | fin d'onboarding |
| GET | `/user/organizations` | — | `[Organization]` | — |
| PATCH | `/user/organizations/:id` | `{ name?, prorataRule? }` (propriétaire) | `Organization` | Paramètres |
| GET | `/user/organizations/:id/onboarding` | — | `{ hasProperty, hasTenant, hasPayment }` | Liste « Pour bien démarrer » |
| POST | `/me/phone/otp`, `/me/phone/verify` | — | — | **à faire** (compte Google / Apple) |

`Organization = { id, name, type, countryCode, currency, timeZone, prorataRule, plan, role }`

Les routes suivantes sont préfixées par `/user/organizations/:orgId` (abrégé `…`). Non-membre : 404 `notFound` ;
rôle insuffisant : 403 `roleForbidden`. Lecture : tous les rôles ; écriture : `owner`, `manager`.

## Biens et unités — **implémenté**

| Méthode | Route | Corps / paramètres | Réponse `data` | Écran |
|---|---|---|---|---|
| GET | `…/properties` | `?filter=late\|vacant&q=&period=` | `[PropertySummary]` | Biens |
| POST | `…/properties` | `{ name, type, district, city, description?, units: [{ label, rent }] }` | `PropertyDetail` | Nouveau bien, onboarding |
| GET | `…/properties/:id` | `?period=2026-10` | `PropertyDetail` | Fiche bien |
| PATCH | `…/properties/:id` | champs du bien | `PropertyDetail` | — |
| POST | `…/properties/:id/units` | `{ units: [{ label, rent }] }` | `[unit]` (409 `unitLabelTaken`) | Ajouter des unités |
| POST | `…/uploads/property-photo` | `{ contentType }` | `{ uploadUrl, photoKey }` | **à faire** (stockage objet) |

`PropertySummary = { id, name, type, district, city, description, photoKey, period, unitCount, occupiedCount, vacantCount, occupancy, expected, collected, lateCount }`
`PropertyDetail = PropertySummary & { units: [{ id, label, rent, lease: LeaseSummary | null }] }`

Pour une villa ou un magasin, l'application envoie une seule unité (`label` « Maison » ou « Local »).

## Locataires et baux — **implémenté** (sauf départ : étape 4)

| Méthode | Route | Corps / paramètres | Réponse `data` | Écran |
|---|---|---|---|---|
| GET | `…/leases` | `?status=active\|ended&rentStatus=late\|partial\|upcoming\|paid&propertyId=&q=&period=` | `[LeaseSummary]` | Locataires |
| POST | `…/leases` | voir ci-dessous + `Idempotency-Key` | `{ lease: LeaseSummary, payments: [Payment] }` | Nouveau locataire |
| GET | `…/leases/:id` | — | `LeaseSummary & { payments, balance: { arrears, arrearsByPeriod, prepaid } }` | Fiche locataire |
| GET | `…/leases/:id/settlement-preview` | `?exitDate=&deductArrears=true&deductions=` | `SettlementPreview` | Départ — **étape 4** |
| POST | `…/leases/:id/departure` | `{ exitDate, deductArrears, deductions: [{ label, amount }], refundMethod? }` | `settlement` | Départ — **étape 4** |

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

`rent` est facultatif (loyer de l'unité par défaut). Le serveur calcule la caution (`rent × depositMonths`) et les montants
de l'avance avec `rentForPeriod` (règle de prorata de l'organisation) ; il ignore tout montant envoyé.
Un locataire dont le numéro est déjà connu dans l'espace est réutilisé.

`LeaseSummary = { id, tenant: { id, firstName, lastName, phone }, unit: { id, label }, property: { id, name }, rent, dueDay, entryDate, exitDate, depositMonths, depositAmount, advanceMonths, period, due, paid, status, dueDate }`
avec `status` ∈ `paid | partial | late | upcoming` pour la période demandée (par défaut le mois en cours dans le fuseau du pays),
calculé par `periodRentStatus` de `@zhking13/kaza-domain` 0.2.0 : en retard **le lendemain** de l'échéance.

Erreurs : `unitNotVacant` (409), `unitNotFound`, `notFound` (404), `tenantPhoneInvalid` (422).

## Synchronisation — **implémentée**

| Méthode | Route | Réponse `data` | Usage |
|---|---|---|---|
| GET | `…/snapshot` | `{ organization, properties: [{ …, units }], leases, payments, syncedAt }` | Démarrage de l'application : cache local complet (paiements non annulés) |

## Paiements

| Méthode | Route | Corps / paramètres | Réponse | Écran |
|---|---|---|---|---|
| GET | `…/payments` | `?period=2026-10&leaseId=&cursor=` | `{ items: [Payment], nextCursor }` | Paiements, historique (étape 4 ; le snapshot suffit pour l'instant) |
| POST | `…/payments` | `{ leaseId, amount, method, period, receivedAt? }` + `Idempotency-Key` | `Payment` — **implémenté** (owner, manager, collector ; `periodBeforeEntry`, `periodAfterExit`) | Encaisser |
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
