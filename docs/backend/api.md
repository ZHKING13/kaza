# Kaza — contrat d'API v1

Base : `/api/v1` (socle repris d'ack-nestjs-boilerplate dans `kaza-api`). JSON. Dates ISO 8601 ; périodes au format `YYYY-MM` ;
montants en francs CFA entiers.
Toute requête porte `x-api-key: <key>:<secret>` (clé de l'application, type `default`).
Authentification : `Authorization: Bearer <access token>` en plus, sauf mention « public ».
Réponses au format ack : `{ statusCode, message, metadata, data }` ; langue des messages : français par défaut, `x-custom-lang: en` sinon.
Les écritures d'argent acceptent `Idempotency-Key: <uuid>` (rejeu sans doublon).
Les créations (espace, bien et ses unités, unités, bail, paiement) acceptent aussi un `id` (UUID) choisi par l'application :
rejouer la même création renvoie l'enregistrement existant ; un `id` déjà pris ailleurs donne 409 `idConflict`.
C'est ce qui permet la file d'envoi hors ligne de l'application.

Erreurs : `{ "statusCode": 5xxxx, "statusCodeKey": "otpInvalid", "module": "auth", "message": "Code incorrect.", "metadata": {…} }`
(messages en français, prêts à afficher). Les codes d'erreur ci-dessous correspondent à `statusCodeKey`.

## Authentification — **implémentée** (`kaza-api`, étape 2)

| Méthode | Route | Corps | Réponse `data` | Écran |
|---|---|---|---|---|
| POST | `/public/app-integrity/challenge` | — | `{ challenge, expiresInSeconds: 300 }` | Connexion (avant l'envoi du code) |
| POST | `/public/auth/otp/send` | `{ phone: "+2250712345678", channel?: "whatsapp" \| "sms", integrity?: Proof }` | `{ channel, resendInSeconds: 30, expiresInSeconds: 300 }` | Connexion |
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

**Intégrité de l'application.** `x-api-key` identifie l'application mais n'est pas secret. L'envoi d'un code coûtant
un message, le serveur peut exiger une preuve que la demande vient de la vraie application (`APP_INTEGRITY_MODE` :
`off`, `report`, `enforce`). Elle est liée à la chaîne `otp-send:<challenge>:<phone>` :
- Android : `Proof = { platform: "android", challenge, token }`, jeton Play Integrity (requête standard) dont le
  `requestHash` est le SHA-256 hexadécimal de la chaîne ;
- iOS : `Proof = { platform: "ios", challenge, keyId, attestation }` à la première utilisation d'une clé App Attest,
  puis `{ platform: "ios", challenge, keyId, assertion }`.

L'application fait tout cela dans `src/lib/integrity.ts` ; sur le web, ou si la plateforme ne sait pas produire de
preuve, la demande part sans. Erreurs (403) : `integrityRequired`, `integrityInvalid`, `integrityKeyUnknown` (clé
inconnue : l'application en atteste une nouvelle et réessaie une fois).

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

## Locataires et baux — **implémenté**

| Méthode | Route | Corps / paramètres | Réponse `data` | Écran |
|---|---|---|---|---|
| GET | `…/leases` | `?status=active\|ended&rentStatus=late\|partial\|upcoming\|paid&propertyId=&q=&period=` | `[LeaseSummary]` | Locataires |
| POST | `…/leases` | voir ci-dessous + `Idempotency-Key` | `{ lease: LeaseSummary, payments: [Payment] }` | Nouveau locataire |
| GET | `…/leases/:id` | — | `LeaseSummary & { payments, balance: { arrears, arrearsByPeriod, prepaid } }` | Fiche locataire |
| POST | `…/leases/:id/settlement-preview` | `{ exitDate, deductArrears = true, deductions: [{ label, amount }] }` | `SettlementPreview` | Départ (aperçu, rien n'est enregistré) |
| POST | `…/leases/:id/departure` | `{ id, exitDate, deductArrears = true, deductions, refundMethod? }` | `{ settlement: Settlement, payments: [Payment], voidedPaymentIds }` | Départ |

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

### Départ et solde de tout compte

Réservé au propriétaire et au gérant. Tous les montants sont recalculés par le serveur avec `computeSettlement`
(`@zhking13/kaza-domain`), à partir des paiements et de la règle de prorata de l'espace ; seules les retenues
(réparations, factures…) viennent du corps de la requête.

`SettlementPreview = { exitDate, deposit, prepaid, arrears, arrearsByPeriod: [{ period, amount }], arrearsDeducted, arrearsLeft, deductions, balance }`
— `balance` > 0 : à rembourser au locataire ; < 0 : le locataire doit encore cette somme.

`POST …/departure`, en une transaction :
- date de sortie posée sur le bail (l'unité redevient vacante) ;
- impayés retenus (`deductArrears`) : un paiement par mois réglé, méthode `caution`, source `settlement` ;
- paiements d'avance des mois après la sortie annulés (« Avance rendue au départ ») ;
- `Settlement = { id, leaseId, exitDate, deposit, prepaid, arrearsDeducted, arrearsLeft, deductions, balance, refundMethod, createdAt }` ;
- ligne `lease.ended` dans le journal.

L'`id` du solde est choisi par l'application (UUID) : rejouer le départ renvoie le solde existant, sans doublon.
Le snapshot porte le solde de chaque bail terminé (`leases[].settlement`).

Erreurs : `alreadyEnded` (409), `exitBeforeEntry` (422), `notFound` (404).

## Synchronisation — **implémentée**

| Méthode | Route | Réponse `data` | Usage |
|---|---|---|---|
| GET | `…/snapshot` | `{ organization, properties: [{ …, units }], leases, payments, syncedAt }` | Démarrage de l'application : cache local complet (paiements non annulés) |

## Paiements — **implémentés** (sauf quittance serveur)

| Méthode | Route | Corps / paramètres | Réponse | Écran |
|---|---|---|---|---|
| GET | `…/payments` | `?period=2026-10&leaseId=&includeVoided=false&cursor=&limit=50` | `{ items: [Payment], nextCursor }` | Paiements, historique (du plus récent au plus ancien ; l'application utilise le snapshot) |
| POST | `…/payments` | `{ leaseId, amount, method, period, receivedAt? }` + `Idempotency-Key` | `Payment` — **implémenté** (owner, manager, collector ; `periodBeforeEntry`, `periodAfterExit`) | Encaisser |
| POST | `…/payments/:id/void` | `{ reason }` | `Payment` (owner, manager ; déjà annulé : renvoyé tel quel ; bail terminé : `leaseEnded` 409) | Quittance → « Annuler ce paiement » |
| GET | `…/payments/:id/receipt` | — | `ReceiptData` (quittance ou reçu partiel) | Quittance (à venir) |

`Payment = { id, leaseId, amount, method, source, period, receivedAt, receiptNumber, voidedAt? }`

`ReceiptData = { kind: "quittance" | "recu_partiel", receiptNumber, landlord, tenant, unit, property, period, amount, amountInWords, dueForPeriod, paidForPeriod, method, receivedAt }`
— l'application continue de produire le PDF ; un rendu PDF serveur (`Accept: application/pdf`) pourra venir ensuite pour l'envoi automatique.

Erreurs : `periodBeforeEntry`, `periodAfterExit` (422), `notFound` (404), `leaseEnded`, `idConflict` (409).

Un paiement annulé reste en base (`voidedAt`, `voidReason`, `voidedById`, ligne `payment.voided` dans le journal) mais
disparaît du snapshot, des totaux et de la situation du mois.

## Tableau de bord — **implémenté**

| Méthode | Route | Paramètres | Réponse | Écran |
|---|---|---|---|---|
| GET | `…/dashboard` | `?period=2026-10` | `{ period, expected, collected, outstanding, lateCount, paidCount, tenantCount, vacantCount, recentPayments: [Payment] }` | Accueil (l'application calcule les mêmes chiffres depuis son cache) |

## Webhooks (public, signés)

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/webhooks/mobile-money/:provider` | Confirmation de paiement de l'agrégateur → `Payment` source `mobile_money`, `externalRef` unique |
| POST | `/webhooks/messaging/:provider` | Statut de livraison WhatsApp / SMS → `Reminder.status` |
