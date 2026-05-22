# ADR 0006 — viewTransition strategy and naming convention

**Date** : 2026-05-22
**Status** : accepted
**Tour** : 20.2

## Contexte

Phase 2 H4 (Wave 1 + Wave 2, branches `chore/h4-view-transitions-wrap` et
`chore/h4-viewtransition-calendar`, non mergées au moment de cette ADR) a
établi `viewTransition()` comme primitive d'animation standard pour les
mutations DOM. ADR 0005 a tranché viewTransition over morphdom pour le
calendar grid.

Tour 20 visait l'extension de `viewTransition()` aux consumer UI surfaces
(routes, modals, detail overlays, sheets). L'audit Tour 20.1 a révélé
**4 conflits directs** avec des animations CSS existantes :

- `.view.active { animation: viewIn ... }` (`index.html:2945`)
- `.view.active { animation: fadeIn ... }` (`index.html:2524`, masqué par
  viewIn dans la cascade)
- `.modal-bg { animation: modalBgIn ... }` + `.modal { animation: modalIn ... }`
  (`index.html:2451-2492`)
- `.detail-overlay.open { animation: detailIn ... }` (`index.html:3088`,
  explicitement annoté "mirrors Apple Music expansion")

Trois scénarios de périmètre ont émergé : MINIMAL (Wave 3a routes seule),
MÉDIAN (3a + 3b modals avec perte modalIn/modalBgIn), MAXIMAL (3a+3b+3c
avec perte des 4 animations dont detailIn).

## Décision

### 1. Périmètre Tour 20 — Scénario MINIMAL (Wave 3a seule)

Tour 20 livre exclusivement Wave 3a :

- Wrap `renderRoute()` dans `viewTransition()`
- Suppression des 2 propriétés `animation:` sur `.view.active` (lignes
  2524 et 2945) — conservation des `@keyframes viewIn` et `@keyframes fadeIn`
  (fadeIn utilisé ailleurs)
- Pas de `view-transition-name` posé en code — cross-fade par défaut sur
  `:root` suffit
- Préset CSS `--motion-route/modal/hero` posé dans `:root` pour usage
  futur

Wave 3b (modals) et Wave 3c (detail overlays) sont **annulées** pour Tour 20.
Reportées Tour 21+ ou Phase 3 polish.

### 2. Convention `view-transition-name` (usage futur)

Posée ici pour cohérence du codebase quand Tour 21+ ou Phase 3 introduira
des `view-transition-name`. Aucune implémentation Tour 20.

```
vt-route-{name}        # cross-fade routes différencié (13 routes)
vt-modal-{kind}        # modals via showModal/hideModal
vt-overlay-{name}      # overlays plein écran (detail, etc.)
vt-sheet-{kind}        # sheets, drawers, popovers
vt-detail-{type}-{id}  # shared elements list → detail
vt-hero-{slot}         # shared elements hero
```

### 3. Mapping durées cibles (préset, implémentation différée)

| Var CSS | Valeur | Usage cible |
|---|---|---|
| `--motion-route` | 250ms | Cross-fade routes (= défaut navigateur, gratuit en Wave 3a) |
| `--motion-modal` | 150ms | Modal open/close (Tour 21+) |
| `--motion-hero` | 400ms | Shared elements hero (Tour 21+) |

Easing : `cubic-bezier(0.4, 0, 0.2, 1)` (brief design figé, déjà en
variable `--ease-standard` du design system).

Tour 20 utilise uniquement le défaut navigateur (~250ms ease-out) qui
matche `--motion-route`. Les variables sont posées mais pas référencées
par pseudo-éléments CSS.

### 4. `prefers-reduced-motion`

Couvert par le fallback no-op existant du helper `viewTransition()`
(`src/features/mobile/transitions.ts`). Aucun câblage CSS supplémentaire
requis Tour 20. Vérification intégrée en revue Wave 3a.

## Alternatives considérées

### MÉDIAN (Wave 3a + 3b)

Rejeté. Coût de perdre `modalIn`/`modalBgIn` (régression modal Apple-style)
sans contrepartie immédiate (cross-fade plat 250ms inférieur au scale-in
380ms ease-emphasized actuel). Recréation via pseudo-éléments CSS = hors
scope Tour 20.

### MAXIMAL (Wave 3a + 3b + 3c)

Rejeté. Idem MÉDIAN + perte de `detailIn` slide-up Apple Music explicitement
voulu comme signature visuelle. Coût symbolique non compensé.

### Conserver toutes les animations CSS et wrapper quand même

Rejeté. Double-animation runtime (CSS + viewTransition snapshot animation) =
effets chaotiques sur des éléments visibles à chaque interaction.

## Conséquences

### Positives

- Cross-fade global sur les 13 routes — premier gain visible utilisateur
  après 19 tours structurels.
- Préservation totale de l'identité visuelle existante : modal Apple-style
  (`modalIn` scale-in ease-emphasized) et detail slide-up Apple Music
  (`detailIn`).
- Convention nommage gravée pour Tour 21+ sans refactor d'ADR.
- 250ms VT < 380ms `viewIn` = transition routes plus snappy.

### Négatives

- Wave 3b (modals) et Wave 3c (detail overlays) restent sans cross-fade
  viewTransition. Ouverture/fermeture modals continuent via CSS pur.
  Fermeture detail overlay reste abrupte (pas d'animation reverse existante).
- L'animation `viewIn` perdue (380ms ease-decelerate) avait une signature
  légèrement plus "douce" que le cross-fade par défaut. Compensation :
  cohérence avec future Wave 3b/3c et possibilité d'enrichir via
  `::view-transition-old/new(:root)` si besoin.

## Trigger de révision

Cette ADR est à ré-examiner si :

- Une demande explicite émerge pour cross-fade sur modals/detail (Tour 21+
  ou Phase 3 polish)
- L'absence d'animation de fermeture detail/modal devient un blocker UX
- Le brief design évolue vers un système motion moins Apple-Music-like

## Règle architecte gravée

**n°13** : Audit des conflits CSS (animations, transitions, keyframes
existantes sur les sélecteurs cibles) AVANT de cadrer le nombre de waves.
Un wrap viewTransition sur un élément avec animation CSS pré-existante
n'est jamais "gratuit" — soit on supprime l'animation, soit on l'orchestre
via pseudo-éléments. Le cadrage initial doit en tenir compte sinon le
nombre de waves est sur-estimé.

## Related

- ADR 0001 (accent gravé)
- ADR 0002 (scrim + glass-edge)
- ADR 0003 (radius)
- ADR 0004 (typo deferred)
- ADR 0005 (viewTransition over morphdom, Wave 2 H4) — branche Wave 2 non
  mergée au moment de cette ADR
- Audit Tour 20.1 : `outputs/audits/tour-20-1-audit.md`
- Helper : `src/features/mobile/transitions.ts`
- Pattern minimal viewTransition (Tour 19 V2) : compute pure AVANT le
  callback, mutations DOM SEULES dans le callback, hooks post-mount APRÈS
  le callback
