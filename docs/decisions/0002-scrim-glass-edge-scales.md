# ADR 0002 — Scrim & Glass-edge scales

**Date** : 2026-05-21
**Status** : accepted
**Tour** : 14.3

## Décision

Deux échelles sémantiques sont introduites dans le design system pour
consolider les valeurs `rgba()` répétitives qui pullulaient dans le bloc
`<style>` d'`index.html`.

### `--scrim-*` (5 niveaux) — overlays noirs

```css
--scrim-subtle: rgba(0, 0, 0, 0.18);
--scrim-light:  rgba(0, 0, 0, 0.30);
--scrim-medium: rgba(0, 0, 0, 0.38);
--scrim-strong: rgba(0, 0, 0, 0.52);
--scrim-heavy:  rgba(0, 0, 0, 0.65);
```

### `--glass-edge-*` (3 niveaux) — bordures/highlights blancs

```css
--glass-edge-subtle:   rgba(255, 255, 255, 0.03);
--glass-edge-standard: rgba(255, 255, 255, 0.07);
--glass-edge-strong:   rgba(255, 255, 255, 0.14);
```

## Mapping appliqué (alphas dans la grille)

### Scrim
- `.18, .20` → `--scrim-subtle`
- `.28, .30, .32` → `--scrim-light`
- `.35, .40` → `--scrim-medium`
- `.50, .55` → `--scrim-strong`
- `.65` → `--scrim-heavy`

### Glass-edge
- `.02, .022, .025, .03, .04` → `--glass-edge-subtle`
- `.05, .06, .07, .075, .08` → `--glass-edge-standard`
- `.11, .14` → `--glass-edge-strong`

## Alphas HORS-GRILLE volontairement conservés

Certains alphas sont structurellement trop éloignés des buckets pour être
absorbés sans risque visuel. Ils restent en hard-code dans le bloc `<style>`
en attendant une future décision (peut-être l'introduction de buckets
spécialisés, ou la suppression de ces cas particuliers).

### Scrim hors-grille (conservés)
- `0.14, 0.15` : zone subtile-ultra (en-dessous de `--scrim-subtle`)
- `0.22, 0.25` : zone intermédiaire subtle/light (équidistante)
- `0.60` : zone intermédiaire strong/heavy
- `0.70, 0.85` : zone heavy-extrême (au-dessus de `--scrim-heavy`)

### Glass-edge hors-grille (conservés)
- `0.10` : intermédiaire standard/strong
- `0.18, 0.24, 0.25` : zone bright (au-dessus de `--glass-edge-strong`)

## Contexte

Le bloc `<style>` d'`index.html` utilisait initialement ~17 alphas distincts
de `rgba(0,0,0,X)` et ~16 de `rgba(255,255,255,X)`. Aucune échelle sémantique
ne couvrait ces usages.

Tour 13 avait pré-tranché un système 3-niveaux pour les deux familles. Tour
14.3 a révisé à **5 niveaux pour scrim** et **3 niveaux pour glass-edge**
après inspection des données réelles (plage scrim 0.18→0.65 trop large pour
3 buckets). Asymétrie volontaire reflétant la dispersion réelle de chaque
famille.

L'audit fin a ensuite révélé que la liste initiale (8 alphas scrim + 5
alphas glass-edge) était un **top-30 par fréquence** du tour 11a, pas un
inventaire exhaustif. ~33 alphas distincts au total. Stratégie hybride
adoptée : substitution des alphas proches d'un bucket (tolérance ±0.03
scrim, ±0.015 glass-edge), conservation hard-code des alphas structurellement
hors-grille.

## Alternatives considérées

- **Mapping 1:1** (1 var par alpha) : juste un renommage, aucune
  consolidation. Rejetée.
- **3-niveaux uniformes** (tour 13) : trop agressif sur scrim. Rejetée.
- **Buckets élargis avec tolérance 0.05+** : risque visuel +22% relatif
  sur les `.18`. Rejetée.
- **7+ niveaux pour couvrir toute la plage sans rounding** : anti-décision
  consolidation. Rejetée.
- **Variables stockant l'alpha seul** : sémantique faible. Rejetée au profit
  de la couleur rgba complète, cohérente avec `--accent-soft`.

## Conséquences

- 80%+ des occurrences `rgba(0,0,0,X)` et `rgba(255,255,255,X)` sont
  remplacées par les nouvelles vars.
- Les alphas hors-grille restent en hard-code, documentés ci-dessus.
- Les variables `--elev-1/2/3/modal` (qui utilisent aussi `rgba(0,0,0,X)`
  dans leurs valeurs box-shadow) **ne sont pas touchées** : elles
  définissent un système d'élévation distinct et plus spécifique.

## Trigger de révision

Cette ADR est à ré-examiner si :
- Un cas hors-grille devient suffisamment fréquent pour justifier un bucket
  dédié.
- La perception visuelle des arrondis (±0.03 scrim, ±0.015 glass-edge)
  s'avère désaccordée — captures comparatives requises pour trancher.
