# Kaza — Design System (MASTER)

> Source de vérité globale. Les fichiers de `pages/` surchargent ces règles pour un écran précis.
> Les valeurs codées sont dans `src/theme/tokens.ts`. Ne jamais écrire une couleur en dur dans un composant.

Généré avec le skill **ui-ux-pro-max** (requêtes : `fintech property rent payment mobile app trust` en mode `--design-system`,
`fintech banking readable modern` en `typography`, `mobile banking app clean` en `style`, stack `react-native`),
puis ajusté au contexte : propriétaires de 45 ans et plus, Android d'entrée de gamme, soleil fort, réseau instable.

## 1. Principes

1. **Confiance avant tout.** Montants exacts, statuts sans ambiguïté, preuve de chaque paiement.
2. **Lisible dehors, au soleil.** Contraste AA minimum (4,5:1) pour tout texte, 16 dp minimum pour le texte courant.
3. **Rapide sur un petit téléphone.** Style plat, pas de flou (blur), pas d'ombres lourdes ni d'animations coûteuses.
4. **Le statut ne repose jamais sur la couleur seule.** Toujours icône + libellé.
5. **Une action principale par écran**, en bas, à portée de pouce.

## 2. Style retenu : Flat « doux »

- Base : **Flat Design** (skill : faible coût, faible risque d'accessibilité, adapté aux MVP mobiles).
- Adouci : rayons de 12 dp sur les cartes, séparation par **bordure 1 dp** plutôt que par ombre.
- Une seule élévation réelle : le bouton flottant « Encaisser » et les bottom sheets.
- **Écarté :** Glassmorphism, proposé par le mode `--design-system`. Le flou est coûteux sur les Android bas de gamme et nuit au contraste en plein soleil.

## 3. Couleurs

### Marque
| Token | Clair | Sombre | Usage |
|---|---|---|---|
| `primary` | `#0F766E` | `#2DD4BF` | Boutons principaux, onglet actif, liens |
| `primaryPressed` | `#115E59` | `#5EEAD4` | État appuyé |
| `onPrimary` | `#FFFFFF` | `#042F2E` | Texte sur `primary` (5,47:1 / 7,77:1) |
| `primarySoft` | `#CCFBF1` | `#134E4A` | Fonds de sélection, puces actives |
| `accent` | `#C2410C` | `#FB923C` | Ocre : Premium et Diaspora uniquement (5,18:1) |

Le vert d'eau (teal) évoque l'argent qui rentre et la stabilité. Il ne ressemble à aucun opérateur :
Orange Money (orange), MTN (jaune), Wave (bleu ciel), Moov (bleu et orange).
Les logos des opérateurs gardent toujours leurs couleurs officielles.

### Neutres (ardoise légèrement bleutée)
| Token | Clair | Sombre |
|---|---|---|
| `bg` | `#F8FAFC` | `#0B1220` |
| `surface` | `#FFFFFF` | `#111A2B` |
| `surfaceAlt` | `#F1F5F9` | `#172238` |
| `border` | `#E2E8F0` | `#25324A` |
| `text` | `#0F172A` (17:1) | `#F1F5F9` (17:1) |
| `textMuted` | `#475569` (7,2:1) | `#94A3B8` (6,8:1) |
| `textDisabled` | `#94A3B8` | `#55627A` |

### Statuts de loyer (sémantique, indépendants de la marque)
| Statut | Texte | Fond | Icône (Lucide) |
|---|---|---|---|
| **Payé** | `#166534` | `#DCFCE7` | `circle-check` |
| **Partiel** | `#92400E` | `#FEF3C7` | `circle-dashed` |
| **En retard** | `#B91C1C` | `#FEE2E2` | `circle-alert` |
| **À venir** | `#1D4ED8` | `#DBEAFE` | `clock` |
| **Vacant** | `#475569` | `#F1F5F9` | `door-open` |

Tous les couples texte/fond dépassent 4,5:1. En mode sombre, les fonds passent à 15 % d'opacité de la teinte et les textes à la nuance 300.

## 4. Typographie

- **Police unique : IBM Plex Sans** (skill : « Financial Trust », recommandée pour banques et fintech, excellente sur les chiffres).
  Graisses chargées : 400, 500, 600, 700, soit environ 4 fichiers pour garder l'application légère.
- **Chiffres tabulaires** (`fontVariant: ['tabular-nums']`) pour tous les montants et toutes les dates.
- Respect du réglage de taille de police du téléphone, jusqu'à 200 %, sans texte coupé.

| Style | Taille / interligne (dp) | Graisse | Usage |
|---|---|---|---|
| `amountXL` | 32 / 40 | 700 | Montant principal du Dashboard |
| `h1` | 24 / 32 | 600 | Titre d'écran |
| `h2` | 20 / 28 | 600 | Titre de section |
| `h3` | 17 / 24 | 600 | Titre de carte, nom du locataire |
| `body` | 16 / 24 | 400 | Texte courant (minimum) |
| `bodyStrong` | 16 / 24 | 600 | Montants dans les listes |
| `small` | 14 / 20 | 400 | Infos secondaires |
| `label` | 13 / 16 | 500 | Badges, onglets, libellés de champ |
| `caption` | 12 / 16 | 500 | Horodatages (jamais en dessous) |

### Formats locaux
- Montant : `125 000 FCFA`, espace insécable fine pour les milliers, devise **après** le nombre.
- Date : `5 oct. 2026` dans les listes, `05/10/2026` dans les formulaires et les quittances.
- Téléphone : `+225 07 12 34 56 78`, groupes de 2 chiffres.

## 5. Espacement, rayons, élévation

- Grille de **4 dp** : 4, 8, 12, 16, 20, 24, 32, 40, 48.
- Marge latérale d'écran : **16 dp**. Espace entre cartes : 12 dp. Padding interne de carte : 16 dp.
- Rayons : `sm` 8 (champs, puces), `md` 12 (cartes, boutons), `lg` 20 (bottom sheets), `full` (badges, avatars, FAB).
- Élévation : `none` partout, `raised` (ombre douce, elevation 6) **uniquement** pour le FAB et les bottom sheets.

## 6. Interaction

- Zone tactile minimale de **48 × 48 dp**. Utiliser `hitSlop` sur les icônes plus petites.
- `Pressable` avec retour visuel (ripple sur Android, opacité sur iOS). Retour haptique léger sur « Encaisser » et sur la confirmation de paiement.
- Animations : 150 à 250 ms, `ease-out`, transform et opacity uniquement. Respecter « réduire les animations ».
- Formulaires : libellé toujours visible au-dessus du champ, erreur sous le champ, clavier adapté (`phone-pad`, `numeric`).
- États obligatoires sur chaque liste : chargement (squelette), vide (illustration + action), erreur, **hors ligne** (bandeau + données en cache).

## 7. Composants de base

`Button` (primary / secondary / ghost / danger, 48 dp de haut), `StatusBadge`, `AmountText`, `Card`, `ListItem`,
`KpiTile`, `TextField`, `PhoneField`, `AmountField`, `SegmentedControl`, `BottomSheet`, `Fab`, `EmptyState`,
`OfflineBanner`, `PaymentMethodLogo`.

## 8. Icônes

- **Lucide** (`lucide-react-native`) : 24 dp, trait de 2. Aucun emoji comme icône.
- Navigation : `house` Accueil · `building-2` Biens · `wallet` Paiements (libellé court : 12 dp minimum sur 5 onglets) · `users` Locataires · `ellipsis` Plus.

## 9. Anti-patterns interdits

- Couleur seule pour indiquer un statut.
- Texte gris clair sur fond gris (en plein soleil, il est illisible).
- Texte courant sous 16 dp, légendes sous 12 dp.
- Flou, verre dépoli, dégradés lourds ou ombres sur chaque carte.
- Montants alignés à gauche dans une colonne (les aligner à droite, en chiffres tabulaires).
- Polices décoratives (le mode `--design-system` proposait Cinzel/Josefin Sans, écartées pour leur lisibilité).

## 10. Marque

Voir `docs/brand-guidelines.md`. Le logo et les icônes sont dans `assets/brand/`.
Le nom et le slogan utilisent **Bricolage Grotesque ExtraBold** (logo uniquement, vectorisé dans les SVG) ;
toute l'interface reste en IBM Plex Sans.
