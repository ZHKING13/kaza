# Kaza — contrat d'API v1

Base : `/v1`. JSON. Dates ISO 8601 ; périodes au format `YYYY-MM` ; montants en francs CFA entiers.
Authentification : `Authorization: Bearer <access token>` sauf mention « public ».
Les écritures d'argent acceptent `Idempotency-Key: <uuid>` (rejeu sans doublon).

Erreurs : `{ "error": { "code": "OTP_INVALID", "message": "Code incorrect.", "details": {} } }`
(messages en français, prêts à afficher).

## Authentification (public)

| Méthode | Route | Corps | Réponse | Écran |
|---|---|---|---|---|
| POST | `/auth/otp/send` | `{ phone: "+2250712345678", channel: "whatsapp" \| "sms" }` | `{ resendIn: 30 }` | Connexion |
| POST | `/auth/otp/verify` | `{ phone, code }` | `Tokens & { isNewUser, user }` | Code |
| POST | `/auth/google` | `{ idToken }` | `Tokens & { isNewUser, user }` | Connexion |
| POST | `/auth/apple` | `{ identityToken, firstName?, lastName? }` | `Tokens & { isNewUser, user }` | Connexion (iOS) |
| POST | `/auth/refresh` | `{ refreshToken }` | `Tokens` | — |
| POST | `/auth/logout` | — | `204` | Plus › Se déconnecter |

`Tokens = { accessToken, refreshToken, expiresIn }`

Codes d'erreur : `OTP_INVALID`, `OTP_EXPIRED`, `OTP_TOO_MANY_ATTEMPTS`, `OTP_RATE_LIMITED` (avec `retryAfter`),
`PHONE_INVALID`, `SOCIAL_TOKEN_INVALID`.

## Profil et organisation

| Méthode | Route | Corps / paramètres | Réponse | Écran |
|---|---|---|---|---|
| GET | `/me` | — | `{ user, organizations: [{ id, name, role }] }` | Démarrage |
| PATCH | `/me` | `{ firstName, lastName }` | `user` | Onboarding › Profil |
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
