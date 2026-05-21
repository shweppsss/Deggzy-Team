# ADR 0003 — Radius system completion

**Date** : 2026-05-21
**Status** : accepted
**Tour** : 15.1

## Décision

Le système de variables `--radius-*` est complété et étendu :

```css
--radius-xs:  6px;    /* inchangé */
--radius-sm:  10px;   /* inchangé */
--radius-md:  14px;   /* NOUVEAU — alias de --radius default, fix bug latent */
--radius:     14px;   /* inchangé (default) */
--radius-lg:  20px;   /* inchangé */
--radius-xl:  28px;   /* inchangé */
--radius-pill: 999px; /* NOUVEAU — pour pills, tags, badges arrondis */
```

## Bug fixé

Audit P2.1 a révélé que 4 occurrences de `border-radius: var(--radius-md)`
existaient dans le bloc <style>, mais que `--radius-md` n'était **défini
nulle part**. Le navigateur résolvait silencieusement ces 4 cas comme
`border-radius: 0`.

Définir `--radius-md: 14px` (alias de `--radius` default) fix ce bug et
restaure la sémantique attendue (l'auteur des 4 lignes pensait
manifestement que `md` faisait partie de l'échelle xs/sm/md/lg/xl).

**Conséquence visuelle** : 4 éléments qui rendaient à `border-radius: 0`
passent à `border-radius: 14px`. Mutation visuelle non-neutre attendue
sur ces 4 cas — à valider en review visuelle de la PR.

## Mapping des substitutions

| Hex/valeur | Occurrences | → Mapping |
|---|---|---|
| `6px` | 8 | `var(--radius-xs)` (match exact) |
| `8px` | 4 | `var(--radius-xs)` (−2px) |
| `10px` | 1 | `var(--radius-sm)` (match exact) |
| `11px` | 1 | `var(--radius-sm)` (−1px) |
| `12px` | 4 | `var(--radius-sm)` (−2px, préfère bucket compact) |
| `13px` | 1 | `var(--radius)` (−1px) |
| `14px` | 1 | `var(--radius)` (match exact) |
| `16px` | 2 | `var(--radius)` (+2px) |
| `18px` | 1 | `var(--radius-lg)` (−2px) |
| `24px` | 1 | `var(--radius-lg)` (+4px) |
| `999px` | 25 | `var(--radius-pill)` (nouveau bucket) |
| `100px` | 8 | `var(--radius-pill)` (nouveau bucket) |
| **Total** | **57** | |

## Valeurs conservées en hard-code

| Valeur | Occurrences | Justification |
|---|---|---|
| `2px` | 6 + 2 corners | Trop petit pour l'échelle, sémantique fonctionnelle (selecteurs, ticks) |
| `4px` | 13 | +50% relatif vers `--radius-xs` trop visible sur petits éléments |
| `inherit` | 4 | Sémantique HTML, pas une valeur |
| `50%` | 32 | Cercles parfaits (avatars, dots) |
| `0` | 1 | Absence de radius volontaire |
| Corner-specific | 4 | Formes complexes (chips arrondis 1 côté, etc.) |

## Alternatives considérées

- **Tout substituer y compris 2px et 4px** : risque visuel +50% trop fort.
  Rejetée.
- **Définir un `--radius-2xs: 4px`** : ajoute un bucket pour 13 occurrences.
  Possible mais reporté — la dette n'est pas urgente, et créer un bucket
  pour absorber des valeurs sans intention design system claire diluerait
  l'échelle. À reconsidérer si 4px devient récurrent dans le futur.
- **Remplacer `var(--radius-md)` par `var(--radius)` partout** : cache le
  bug de nommage. Rejetée au profit de la complétion de l'échelle.

## Conséquences

- 57 substitutions hard-code → variables sémantiques.
- 4 éléments fixés (bug `--radius-md`).
- Échelle complète : xs/sm/md/lg/xl + radius default + pill = 7 vars.
- Pills/tags/badges désormais centralisés sur `--radius-pill`.
- Dette résiduelle : `2px`, `4px`, corner-specific (acceptée).

## Trigger de révision

À ré-examiner si :
- Le rendu des 4 cas `--radius-md` après fix s'avère désaccordé visuellement.
- `4px` devient suffisamment fréquent pour mériter `--radius-2xs`.
