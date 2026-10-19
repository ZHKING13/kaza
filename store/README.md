# Publication sur les stores

Tout ce qu'il faut pour les fiches Google Play et App Store.

| Fichier | Contenu |
|---|---|
| `fiche-play-store.md` | Nom, descriptions, catégorie, classification, accès pour l'examen |
| `fiche-app-store.md` | Nom, sous-titre, texte promotionnel, mots-clés, notes pour App Review, paiement sur iOS |
| `politique-de-confidentialite.md` | Politique de confidentialité, à publier sur une URL publique |
| `confidentialite-stores.md` | Réponses aux questionnaires « Sécurité des données » (Play) et « Confidentialité de l'app » (Apple) |
| `play-icon-512.png` | Icône Play Store 512 × 512 |
| `play-feature-graphic-1024x500.png` | Image de présentation Play Store |
| `captures/android/` | 8 captures 1 080 × 1 920 |
| `captures/ios/` | 8 captures 1 320 × 2 868 (iPhone 6,9 pouces) |

## Avant de soumettre

### Bloquant

- [ ] **Suppression du compte dans l'application** (obligatoire chez Apple et Google) : écran *Plus › Paramètres ›
      Supprimer mon compte* et route API correspondante.
- [ ] **Page web de demande de suppression** (Google l'exige en plus) : URL à renseigner dans la Play Console.
- [ ] **Politique de confidentialité publiée** sur une URL publique, champs `[À COMPLÉTER]` remplis (raison sociale,
      adresse, e-mail, hébergeur, prestataires, autorité de protection des données).
- [ ] **API de production** en ligne (les captures et l'examen se font sur la vraie app).
- [ ] **Compte de test pour l'examen** : un numéro et un code fixe réservés aux équipes d'Apple et de Google.

### À décider

- [ ] **Paiement de l'abonnement sur iOS** : masquer le bouton de paiement sur iOS pour la première version, ou
      ajouter l'achat intégré d'Apple (voir `fiche-app-store.md`).
- [ ] Langue anglaise pour les fiches (facultatif).

### Comptes

- Google Play Console : 25 USD une fois.
- Apple Developer Program : 99 USD par an.

## Refaire les captures

Les captures viennent de la démo web (biens et locataires fictifs), avec le bandeau « démo » masqué.

```bash
npx expo export -p web --output-dir /tmp/kaza-demo
npx http-server /tmp/kaza-demo -p 8098 -s --proxy "http://127.0.0.1:8098?" &
npm i --no-save playwright
node store/scripts/captures-brutes.mjs   # écrans bruts dans store/brut/
node store/scripts/composer.mjs          # captures des stores, bannière et icône
```

Les titres de chaque capture sont dans `store/scripts/composer.mjs` (`slides`).
