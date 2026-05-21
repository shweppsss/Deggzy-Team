# ADR 0004 — Typography rationalization deferred

**Date** : 2026-05-21
**Status** : deferred (action reportée)
**Tour** : 15.2

## Décision

La rationalisation du système typo (`font-size` hard-codés vers variables
`--font-*`) est **reportée à un futur tour dédié**, après une session de
design system typo plus approfondie. Aucune substitution n'est faite dans
ce tour.

## Contexte

Le tour 15.2 visait à rationaliser ~33 valeurs de `font-size` distinctes
dans le bloc `<style>` d'`index.html`. L'audit pré-substitution a révélé
deux obstacles majeurs qui rendent le sweep risqué :

### 1. Les vars `--font-*` ne sont pas des sizes mais des shorthands

Les 7 variables typo (`--font-display-xl/l/m`, `--font-body-l/body`,
`--font-caption`, `--font-micro`) sont définies comme des **shorthands
complets** :

```css
--font-body: 500 14px/1.45 "SF Pro Text", -apple-system, ...;
```

Conséquence : `font-size: var(--font-body)` est invalide. La substitution
correcte est `font: var(--font-body)`, mais elle **écrase aussi le poids,
la line-height et la famille** de tout sélecteur où elle est appliquée.

### 2. Beaucoup de sélecteurs ont des surcharges qui seraient détruites

Sur 47 candidates `font-size` (correspondance exacte avec les sizes des
shorthands), l'audit a identifié **~24 cas où une substitution écraserait
silencieusement une surcharge** :

- Surcharges `font-weight` explicites (`.urgent-title`, `.split-card-name`,
  `.modal-title`, `.kpi-value`, `.auth-profile-name`, etc.)
- Surcharges `line-height` (`html, body` avec lh 1.5 vs `--font-body` lh 1.45)
- Surcharges `font-family: inherit` sur les inputs
- Anti-patterns existants `font: var(--font-X); font-size: Ypx;` qui
  expriment une intention d'override explicite (ex. ligne 3581, ligne 1509)

Le ratio safe/total (~49%) est trop bas pour justifier un sweep. Le coût
d'une régression silencieuse (notamment sur la baseline globale `html, body`)
dépasse le bénéfice de 23 substitutions.

### 3. Le système typo actuel mélange deux concepts non résolus

L'existence simultanée :
- de `font: var(--font-body)` (shorthand complet)
- de `font-size: 14px` hard-codé (size seule)
- de l'anti-pattern `font: var(--font-caption); font-size: 11.5px;`

…montre que le repo a évolué sans choix tranché entre :
- (a) "le système est shorthand complet" (impose weight/lh/family avec)
- (b) "le système est size + props séparés" (size en var, weight/lh libres)

Substituer maintenant verrouillerait implicitement (a), alors que les
sélecteurs existants exploitent souvent (b).

## Alternatives considérées

- **α — Créer une échelle `--font-size-*` séparée** : duplication entre
  shorthands et sizes = deux systèmes parallèles, anti-pattern.
- **β — Migration vers `font:` shorthand** : trop risquée, 51% des cas
  poseraient régression.
- **γ — Status quo silencieux** : laisse la dette pourrir sans documentation.

## Décision retenue : action reportée, diagnostic documenté

Reporter l'action, mais poser noir sur blanc le diagnostic et les
pré-requis avant de relancer.

## Pré-requis pour la rationalisation typo

Un futur tour "design system typo" devra trancher en amont :

1. **Choix shorthand vs size+props** : ADR successeur qui décide si
   `--font-*` reste shorthand ou devient size seule. Recommandation
   préliminaire : **séparer** en `--font-size-*` (taille) + `--font-stack`
   (family + weight defaults) pour permettre les surcharges granulaires.

2. **Grille modulaire** : choisir une échelle (par ex. 10/11/12/13/14/16/18/20/22/24/28/32/40/48/56/64/72) et arbitrer les valeurs hors-grille (les ~17 demi-pixels).

3. **Session de captures de référence** : avant arbitrage des demi-pixels,
   capturer 5-10 écrans clés de l'app pour visualiser l'intention des
   tunes manuels (`.brand-sub` à 9.5px, `.cal-event` à 9.5px en mobile,
   etc.).

4. **Validation visuelle obligatoire** : tour exécution requerra des
   captures avant/après comme posé en tour 13.

## Open items générés

- [ ] Décision shorthand vs size+props (ADR successeur)
- [ ] Design d'une grille modulaire pour l'échelle font-size
- [ ] Audit des intentions de demi-pixels via captures (~7 valeurs)
- [ ] Cleanup latéral : suppression de la `font-size: 28px` redondante
      ligne 1509 (équivalente au `font: var(--font-display-l)` précédent)
- [ ] Décision sur l'anti-pattern shorthand+size (formaliser ou supprimer)

## Volume de dette typo non-traitée (référence)

- 109 occurrences `font-size: <X>px` au total dans le bloc `<style>`
- 23 valeurs entières distinctes (9px → 72px, plage 8× d'écart)
- 7 valeurs demi-pixel distinctes (8.5/9.5/10.5/11.5/12.5/13.5/14.5)
- 3 cas non-px (0, 0.9em, inherit)

## Trigger de relance

Cette ADR est à reconsidérer quand :
- Une session design typo dédiée a tranché les pré-requis ci-dessus.
- Un audit user montre des régressions visuelles sur la lisibilité (ce
  qui forcerait à toucher la typo).
- La phase 1 design system bascule en phase 2 (refonte par domaine), où
  certains domaines pourront localement rationaliser leur typo.
