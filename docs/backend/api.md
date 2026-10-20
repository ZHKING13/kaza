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
| POST | `…/properties/:id/units` | `{ units: [{ label, rent }] }` | `[unit]` (409 `unitLabelTaken` ; villa ou magasin : une seule unité, 422 `singleUnit`) | Ajouter des unités |
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
  "endDate": "2027-10-19",
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

### Révision du loyer, fin du contrat, préavis (étape 8)

Réservé au propriétaire et au gérant ; chaque route renvoie la fiche (`LeaseSummary & { payments, balance }`).

| Méthode | Route | Corps | Écran |
|---|---|---|---|
| POST | `…/leases/:id/rent-revisions` | `{ id?, amount, from: "YYYY-MM", reason?, notifyTenant = true, applyToUnit = true }` | Réviser le loyer |
| POST | `…/leases/:id/rent-revisions/:revisionId/cancel` | — | Réviser le loyer › Annuler |
| PUT | `…/leases/:id/end-date` | `{ endDate: "YYYY-MM-DD" \| null }` | Fin du contrat et préavis |
| POST | `…/leases/:id/notice` | `{ from: tenant\|landlord, date, exitDate?, reason? }` | Fin du contrat et préavis |
| POST | `…/leases/:id/notice/cancel` | — | Retirer le préavis |

- Le loyer d'un mois se lit sur l'échéancier (loyer d'entrée puis révisions) : `rentAt` de `@zhking13/kaza-domain` 0.4.0.
  Une révision commence au plus tôt le mois en cours, après le mois d'entrée (`revisionInPast`, 422) ; les mois passés
  ne changent jamais. Une révision qui ne porte pas sur un mois passé peut être retirée (`revisionNotFound` sinon).
- `exitDate` du préavis : par défaut la date du préavis plus la durée de l'espace (`leases.noticeTenantMonths` /
  `noticeLandlordMonths`) ; `noticeDatesInvalid` (422) si le préavis précède l'entrée ou le départ précède le préavis.
- `LeaseSummary` ajoute `rentHistory: [{ id, from, amount, reason, createdAt }]` (le premier, `id: null`, est le loyer
  d'entrée), `endDate`, `notice: { from, date, exitDate, reason } | null`, `end: { kind: notice | contract_end |
  contract_expired, date, daysLeft } | null` et `revisionDue`. `rent` est le loyer du mois de la situation.
- Snapshot : `leases[].rent` est le loyer d'entrée, `leases[].rents` les révisions, plus `endDate` et `notice`.
- Réglages de l'espace : `PATCH …/organizations/:id` avec `leases: { noticeTenantMonths, noticeLandlordMonths,
  leaseEndAlertDays, rentRevisionAlertMonths }`.
- Le solde de départ retient la caution versée à l'entrée (`depositAmount`), pas `depositMonths` × loyer révisé.

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
| POST | `…/payments` | `{ leaseId, amount, method, period, receivedAt? }` + `Idempotency-Key` | `Payment` — **implémenté** (owner, manager, collector ; `periodBeforeEntry`, `periodAfterExit` ; au-delà du reste dû du mois : `amountTooHigh` 422 `{ maxAmount, lastPeriod }`) | — |
| POST | `…/payments/allocations` | `{ ids?, leaseId, amount, method, startPeriod?, receivedAt? }` + `Idempotency-Key` | `{ payments: [Payment] }` — impayés plus anciens d'abord, puis `startPeriod` et les mois suivants, 12 mois d'avance au plus, un paiement par mois (`amountTooHigh` 422 au-delà) | Encaisser |
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

## Messages aux locataires — **implémentés** (étape 5)

Envoyés par le serveur sur le WhatsApp du locataire (modèles approuvés par Meta), par SMS si WhatsApp échoue,
entre 8 h et 20 h à l'heure du pays pour les relances automatiques.

| Méthode | Route | Réponse `data` | Écran |
|---|---|---|---|
| PATCH | `/user/organizations/:id` avec `{ messaging: { remindersEnabled?, reminderDaysBefore?, reminderLateRepeatDays?, reminderLateMax?, autoMessagesEnabled? } }` | `Organization` (avec `messaging`) | Paramètres › Messages aux locataires (propriétaire) |
| GET | `…/leases/:id/messages` | `[Message]` (50 derniers) | Fiche locataire › Messages envoyés |
| POST | `…/leases/:id/messages/rent-reminder` | `Message` (202) | Fiche locataire › Envoyer une relance par Kaza |
| POST | `…/payments/:id/messages/receipt` | `Message` (202) | Quittance › Envoyer la quittance par Kaza |

`Message = { id, leaseId, paymentId, kind, period, occurrence, channel, status, error, createdAt, sentAt, deliveredAt, readAt }`
avec `kind` ∈ `rent_due_soon | rent_late | rent_manual | receipt | welcome | settlement` et
`status` ∈ `queued | sent | delivered | read | failed | cancelled`.

- Automatique : rappel `reminderDaysBefore` jours avant l'échéance, relance le lendemain puis tous les
  `reminderLateRepeatDays` jours (`reminderLateMax` fois) si `remindersEnabled` ; quittance PDF après chaque
  encaissement, bienvenue à l'entrée et solde au départ si `autoMessagesEnabled`. Désactivé par défaut.
- À la demande : une relance par locataire et par jour, un renvoi de quittance par paiement et par jour
  (`alreadySent`, 409). Relance refusée si le mois est réglé (`rentNotDue`, 422) ou le locataire parti (`leaseEnded`, 409).
- Rôles : propriétaire, gérant et collecteur peuvent envoyer ; seul le propriétaire change les réglages.
- Hors ligne, l'application n'envoie rien plus tard : une relance partie des heures après surprendrait le locataire.

## Paiement en ligne — **implémenté** (étape 6, agrégateur à choisir)

| Méthode | Route | Corps | Réponse `data` | Rôles | Écran |
|---|---|---|---|---|---|
| POST | `…/leases/:id/payment-requests` | `{ period?, amount?, send = true }` | `PaymentRequest` | propriétaire, gérant, collecteur | Fiche › Envoyer un lien de paiement |
| GET | `…/leases/:id/payment-requests` | — | `[PaymentRequest]` | tous | Fiche › Paiement en ligne |
| POST | `…/payment-requests/:id/cancel` | — | `PaymentRequest` | propriétaire, gérant, collecteur | Fiche › Annuler |
| GET | `/public/pay/:id` | — | redirection vers l'agrégateur, ou page « payé » / « plus valable » | locataire | — |
| POST | `/public/webhooks/payments/:gateway` | notification de l'agrégateur (signée) | — | agrégateur | — |

`PaymentRequest = { id, leaseId, period, amount, currency, status, link, paymentId, expiresAt, paidAt, createdAt }`,
`status` ∈ `pending | paid | failed | expired | cancelled`. L'espace porte `onlinePaymentsEnabled`.

- Par défaut, le lien porte sur le reste dû du mois en cours ; le lien en attente pour le même mois et le même montant
  est réutilisé ; valable 3 jours. Message WhatsApp `kaza_payment_link`.
- Le paiement confirmé devient un `Payment` avec `source: "mobile_money"` (dans le snapshot) ; l'application l'affiche
  « payé en ligne ». Journal : `payment_request.created`, `payment_request.cancelled`, `payment.received`.
- Erreurs : `onlinePaymentsDisabled`, `leaseEnded`, `notPending` (409), `nothingDue` (422), `notFound` (404).

## Espace locataire — **implémenté**

Chaque bail en cours a un lien personnel (`leases[].tenantLink` dans le snapshot, `portalUrl` dans l'application) :
page web sans compte où le locataire voit ce qui reste à payer, ses quittances, les numéros où payer directement le
bailleur, et signale un paiement (« J'ai payé »).

| Méthode | Route | Corps | Réponse `data` | Rôles | Écran |
|---|---|---|---|---|---|
| PATCH | `…/organizations/:id` | `{ payoutAccounts: [{ method, number, name }] }` | `Organization` | propriétaire, gérant | Plus › Paiement direct |
| GET | `…/payment-declarations?status=pending\|all` | — | `{ declarations: [PaymentDeclaration] }` | tous | Paiements à confirmer |
| POST | `…/payment-declarations/:id/reject` | `{ reason }` | `PaymentDeclaration` | propriétaire, gérant, collecteur | Paiements à confirmer › Refuser |
| POST | `…/payments/allocations` | `{ …, declarationId }` | `{ payments }` | propriétaire, gérant, collecteur | Paiements à confirmer › Encaisser |
| POST | `…/leases/:id/tenant-link` | — | `{ leaseId, url }` | propriétaire, gérant | Fiche › Espace locataire › Nouveau lien |
| GET | `/public/l/:code` | — | page HTML | locataire | — |

`PaymentDeclaration = { id, leaseId, amount, method, paidOn, reference, note, proofUrl, status, rejectReason, decidedAt, createdAt }`,
`status` ∈ `pending | confirmed | rejected`. Le snapshot porte `paymentDeclarations` (en attente) ; l'espace porte
`payoutAccounts` (`method` ∈ `wave | orange | mtn | moov`, numéro E.164, 4 au plus).

- Confirmer = encaisser avec `declarationId` : la déclaration passe `confirmed` avec les paiements, une seule fois
  (`declarationAlreadyConfirmed`, 409). Refuser hors ligne passe par la file d'envoi (`rejectDeclaration`).
- Notification `payments` « Paiement à confirmer », `data.screen = "declarations"`.
- Journal : `payment_declaration.created`, `payment_declaration.confirmed`, `payment_declaration.rejected`,
  `tenant_link.regenerated`.

## Dépenses — **implémentées** (étape 12)

| Méthode | Route | Corps | Réponse `data` | Rôles | Écran |
|---|---|---|---|---|---|
| POST | `…/expenses` | `{ id, propertyId, unitId?, category, amount, date, method, supplier?, note?, repeatMonthly? }` | `{ expense, schedule }` | propriétaire, gérant | Fiche du bien › Ajouter une dépense |
| GET | `…/expenses` | `?propertyId&from&to` | `[Expense]` | tous | — |
| PATCH | `…/expenses/:id` | champs à modifier (null efface) | `Expense` | propriétaire, gérant | Dépense |
| POST | `…/expenses/:id/void` | `{ reason }` | `Expense` | propriétaire, gérant | Dépense › Annuler |
| PUT / DELETE | `…/expenses/:id/receipt` | multipart, champ `file` | `{ receiptUrl }` | propriétaire, gérant | Justificatif |
| PATCH / POST | `…/expense-schedules/:id`, `…/stop` | `{ amount?, … }` / — | `ExpenseSchedule` | propriétaire, gérant | Dépense › Arrêter |
| PATCH | `…/properties/:id` | `{ landlordName, landlordPhone, commissionBps }` | `Property` | propriétaire, gérant | Propriétaire du bien |

Snapshot : `expenses`, `expenseSchedules`, mandant sur `properties`. Rapports calculés par l'application (`buildReport`).

## Notifications push — **implémentées** (étape 11)

| Méthode | Route | Corps | Réponse `data` | Rôles | Écran |
|---|---|---|---|---|---|
| POST | `/user/me/push-devices` | `{ token: "ExponentPushToken[…]", platform: ios\|android, appVersion? }` | — | utilisateur | démarrage, « Activer les notifications » |
| POST | `/user/me/push-devices/remove` | `{ token }` | — | utilisateur | déconnexion |
| GET / PATCH | `/user/me/notification-settings` | `{ payments?, late?, lease?, subscription?, team?, teamPayments? }` | `{ …types, devices }` | utilisateur | Paramètres › Mes notifications |
| GET | `/user/me/deletion` | — | `{ owned: [{ id, name, units, tenants, otherMembers }], memberOf: [{ id, name }] }` | utilisateur | Paramètres › Supprimer mon compte |
| POST | `/user/me/delete` | `{ confirmation: "SUPPRIMER" }` | — (définitif) | utilisateur | Paramètres › Supprimer mon compte |
| GET | `/user/me/notifications` | `?before=<createdAt>&limit=30` | `{ items: [{ id, organizationId, category, title, body, data, readAt, createdAt }], unread, hasMore }` | utilisateur | Accueil › cloche |
| POST | `/user/me/notifications/read` | `{ ids? }` (toutes sans `ids`) | `{ unread }` | utilisateur | Notifications › « Tout marquer comme lu », ou toucher une notification |

Notification : `title`, `body`, `data = { screen: tenant|late|subscription|team, organizationId, leaseId?, paymentId? }`.
Envoi par le service push d'Expo ; un téléphone désinstallé est retiré seul. Jamais aux locataires.
Chaque notification d'un type activé est aussi gardée 90 jours dans le centre de notifications (même sans téléphone).

## Abonnements — **implémentés** (étape 10)

| Méthode | Route | Corps | Réponse `data` | Rôles | Écran |
|---|---|---|---|---|---|
| GET | `…/subscription` | — | `Subscription` | tous | Plus › Mon offre |
| POST | `…/subscription/checkout` | `{ plan: starter\|pro\|agency, months: 1\|3\|12 }` | `{ invoice, checkoutUrl }` | propriétaire | Mon offre › Choisir |
| PUT | `/system/subscriptions/:organizationId` | `{ plan, paidUntil?, trialEndsAt? }` | `Subscription` | clé système | Back office |

`Subscription = { plan, status: trial|active|grace|expired|free, effectivePlan, endsAt, daysLeft, trialEndsAt, paidUntil,
limits, usage: { units, members, messagesThisMonth }, billingAvailable, welcome, catalog, invoices }`.
Pas d'essai : un espace démarre en offre Gratuit (3 logements, 5 messages Kaza par mois). `welcome = { endsAt, daysLeft,
discounts: [{ months: 3, percent: 25 }, { months: 12, percent: 20 }] } | null` : offre de bienvenue, 30 jours après la
création du compte du propriétaire, sur son premier paiement, une fois par personne. `catalog[].prices[] = { months,
amount (à payer), fullAmount, percent }` ; la facture porte `welcomePercent`. L'espace (`/user/me`,
snapshot) porte `subscription: { plan, status, effectivePlan, endsAt, daysLeft }`. Refus pour cause d'offre : 403
`unitsLimit`, `membersLimit`, `featureLocked`, `messagesQuota`, avec `data.suggestedPlan` / `suggestedPlanLabel`.

## Identité de l'espace et images — **implémentées** (étape 9)

| Méthode | Route | Corps | Réponse `data` | Rôles | Écran |
|---|---|---|---|---|---|
| GET | `…/identity` | — | `Identity` | tous | Identité et quittances |
| PATCH | `…/identity` | `{ legalName?, address?, phone?, email?, registrationNumber?, taxId?, brandColor?, receiptFooter? }` (null efface) | `Identity` | propriétaire | Identité › Enregistrer |
| PUT / DELETE | `…/identity/logo`, `…/identity/stamp` | multipart, champ `file` (JPEG ou PNG, 2 Mo) | `Identity` | propriétaire | Logo, cachet |
| PUT / DELETE | `…/properties/:id/photo` | multipart, champ `file` | `{ photoUrl }` | propriétaire, gérant | Fiche du bien › Changer la photo |

`Identity = { legalName, address, phone, email, registrationNumber, taxId, brandColor, receiptFooter, logoUrl, stampUrl }`.
Les images ne sont jamais publiques : `logoUrl`, `stampUrl` et `photoUrl` sont des liens signés valables 6 h, renouvelés
par chaque snapshot (`identity`, `properties[].photoUrl`). Erreurs : `extensionInvalid` (415), `exceedMaxSizeUpload` (413).
`brandColor` ∈ `brandColors` de `@zhking13/kaza-domain` 0.5.0.

## Équipe et journal d'activité — **implémentés** (étape 7)

| Méthode | Route | Corps | Réponse `data` | Rôles | Écran |
|---|---|---|---|---|---|
| GET | `…/members` | — | `[Member]` | tous | Plus › Équipe |
| PATCH | `…/members/:userId` | `{ role }` | `[Member]` | propriétaire | Équipe › Modifier |
| DELETE | `…/members/:userId` | — | — | propriétaire, ou soi-même (quitter) | Équipe |
| GET | `…/invitations` | — | `[Invitation]` | propriétaire, gérant | Équipe |
| POST | `…/invitations` | `{ phone, role }` | `Invitation` | propriétaire | Équipe › Inviter |
| DELETE | `…/invitations/:id` | — | — | propriétaire | Équipe › Annuler |
| GET | `/user/invitations` | — | `[ReceivedInvitation]` | compte | Onboarding, accueil, Invitations |
| POST | `/user/invitations/:id/accept` · `decline` | — | `Organization` · — | compte | Rejoindre · Refuser |
| GET | `…/activity` | `?cursor=&limit=30` | `{ items: [Activity], nextCursor }` | propriétaire, gérant | Plus › Journal d'activité |

`role` ∈ `manager | collector | viewer` (le propriétaire est le créateur de l'espace).
`Member = { userId, firstName, lastName, phone, role, joinedAt, isMe }`,
`Invitation = { id, phone, role, status, expiresAt, createdAt, invitedBy: { id, name } }`,
`ReceivedInvitation = { id, role, expiresAt, organization: { id, name, type }, invitedBy }`,
`Activity = { id, action, actor: { id, name, role }, entityType, entityId, subject, data, createdAt }`.

- Invitation valable 7 jours, une seule en attente par numéro et par espace (inviter à nouveau la renouvelle) ;
  message WhatsApp `kaza_invitation` vers le numéro invité.
- Erreurs : `alreadyMember`, `invitationExpired`, `ownerCannotLeave` (409), `roleNotAllowed`, `phoneInvalid` (422),
  `invitationNotFound`, `memberNotFound` (404).

## Webhooks (public, signés)

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/webhooks/mobile-money/:provider` | Confirmation de paiement de l'agrégateur → `Payment` source `mobile_money`, `externalRef` unique |
| GET / POST | `/public/webhooks/whatsapp` | **Implémenté** : vérification de l'abonnement Meta, puis statuts de livraison WhatsApp (`X-Hub-Signature-256`) → `Reminder.status` |
