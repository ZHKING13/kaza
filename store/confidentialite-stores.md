# Questionnaires de confidentialité des stores

Réponses à reporter dans **Google Play Console › Sécurité des données** et **App Store Connect › Confidentialité de
l'app**. Elles décrivent l'application telle qu'elle est codée aujourd'hui ; à revoir si une fonction change.

## Google Play — Sécurité des données

**Collecte ou partage de données utilisateur : Oui.**
**Données chiffrées en transit : Oui.**
**L'utilisateur peut demander la suppression de ses données : Oui** (dans l'app et par URL web — à mettre en place
avant la soumission, voir `README.md`).

| Catégorie Play | Type | Collectée | Partagée* | Facultative | Finalités |
|---|---|---|---|---|---|
| Informations personnelles | Nom | Oui | Non | Non | Fonctionnalités de l'app, gestion du compte |
| Informations personnelles | Adresse e-mail | Oui (connexion Google/Apple) | Non | Oui | Gestion du compte |
| Informations personnelles | Numéro de téléphone | Oui | Non | Non | Fonctionnalités de l'app, gestion du compte, sécurité |
| Informations personnelles | Adresse | Oui (adresse imprimée sur les quittances) | Non | Oui | Fonctionnalités de l'app |
| Informations financières | Historique d'achats (abonnement) | Oui | Non | Oui | Fonctionnalités de l'app |
| Informations financières | Autres infos financières (loyers, paiements, dépenses) | Oui | Non | Non | Fonctionnalités de l'app |
| Photos et vidéos | Photos | Oui | Non | Oui | Fonctionnalités de l'app |
| Contacts | Contacts | Oui (le seul contact choisi) | Non | Oui | Fonctionnalités de l'app |
| Messages | Autres messages (relances, quittances envoyées) | Oui | Non | Oui | Fonctionnalités de l'app |
| Infos et performances de l'app | Journaux de plantage, diagnostics | Oui | Non | Non | Analyse (correction des bugs) |
| Identifiants de l'appareil | Jeton de notification, attestation d'intégrité | Oui | Non | Oui | Fonctionnalités de l'app, prévention des fraudes et sécurité |

\* Google ne compte pas comme « partage » la transmission à des prestataires qui traitent les données pour le compte de
Kaza (hébergement, WhatsApp, SMS, agrégateur de paiement, notifications). Kaza ne vend et ne transmet de données à aucun
tiers pour son propre usage.

Non collectés : position, santé, navigation web, contacts en bloc, audio, fichiers, calendrier, identifiant publicitaire.

## Apple — Confidentialité de l'app

**Suivi (tracking) : Non.** Aucune donnée n'est utilisée pour du suivi publicitaire ni liée à des données d'autres
entreprises.

| Type de données Apple | Lié à l'identité | Finalité |
|---|---|---|
| Coordonnées › Nom | Oui | Fonctionnalités de l'app |
| Coordonnées › Adresse e-mail | Oui | Fonctionnalités de l'app (connexion Google/Apple) |
| Coordonnées › Numéro de téléphone | Oui | Fonctionnalités de l'app |
| Coordonnées › Adresse physique | Oui | Fonctionnalités de l'app (quittances) |
| Achats › Historique d'achats | Oui | Fonctionnalités de l'app (abonnement) |
| Données financières › Autres données financières | Oui | Fonctionnalités de l'app (loyers, paiements) |
| Contacts | Oui | Fonctionnalités de l'app (contact choisi) |
| Contenu utilisateur › Photos | Oui | Fonctionnalités de l'app |
| Contenu utilisateur › Autre contenu (messages aux locataires) | Oui | Fonctionnalités de l'app |
| Identifiants › ID utilisateur | Oui | Fonctionnalités de l'app |
| Identifiants › ID d'appareil (jeton push) | Oui | Fonctionnalités de l'app |
| Diagnostics › Données de plantage | Non | Fonctionnalités de l'app |

## Déclarations d'autorisations Android

| Autorisation | Justification à donner |
|---|---|
| `READ_CONTACTS` | Choisir un contact pour remplir la fiche d'un locataire ; seul le contact choisi est lu. |
| Appareil photo / photos | Photographier un bien, un justificatif de dépense, choisir un logo. |
| Notifications | Paiements reçus, retards, fins de contrat, équipe. |

`WRITE_CONTACTS` est bloquée dans la configuration (`blockedPermissions`).
