# ADR 0007 — `--media-frame` token (pure neutral black for media backdrops)

**Date** : 2026-05-22
**Status** : accepted
**Tour** : 21 (Wave 5)

## Décision

Introduction d'un token sémantique dédié pour le **fond noir derrière les
médias** (images, vidéos, iframes) qui ne remplissent pas leur conteneur
(letterboxing).

| Variable | Valeur |
|---|---|
| `--media-frame` | `#000` |

Déclaration dans `:root` d'`index.html`, juste après le bloc `--danger /
--success / --warning` (section "Semantic").

## Contexte

L'audit Tour 21.1 Wave 5 a recensé 3 usages de `background: #000` codés
en dur :

- `.inspi-preview-wrap` (`index.html:6188`) — wrap derrière image preview
- `.inspi-preview-embed` (`index.html:6198`) — wrap iframe (YouTube etc.)
- `.inspi-media-video, .inspi-media-image` (`index.html:6440`) — média
  rendu dans la vue detail

Ces 3 usages partagent un rôle visuel unique : **media frame backdrop**,
c'est-à-dire le noir qui apparaît derrière un média ne remplissant pas
ses dimensions de conteneur (analogue aux black bars d'un lecteur vidéo).

## Alternatives considérées

- **A — Substitution par `var(--bg)`** : aligner les 3 cas sur le token
  fond système (`--bg: #08080A`). **Rejetée** : `--bg` a une teinte
  bleue-violette subtile (`R=8, G=8, B=10`) qui est imperceptible en UI
  globale mais devient visible en juxtaposition avec une image en
  niveaux de gris ou monochrome (le système visuel humain attribue la
  couleur perçue au cadre quand celui-ci n'est pas perceptuellement
  neutre). Dégradation colorimétrique imperceptible mais réelle.
- **B — Conservation du `#000` inline + commentaires** : ne pas créer de
  variable, juste documenter l'intention par commentaires CSS adjacents.
  **Rejetée** : commentaire fragile (suppression facile lors d'une
  refactor future), pas de traçabilité dans le DS lui-même, et risque
  qu'un futur "fix" bien intentionné substitue par `var(--bg)` sans
  lire le commentaire.
- **C — Token retenu `--media-frame`** : déclaration explicite d'un rôle
  sémantique distinct, valeur identique (`#000`), substitution des 3
  usages.

## Conséquences

- **Sémantique explicite** : le nom du token documente l'intention dans
  le DS, plus seulement dans un commentaire qui peut disparaître.
- **Protection contre fausse correction** : un futur audit "alphas noir
  hors-grille" ou "substitution `#000`" ne touchera plus ces 3 cas car
  ils sont déjà tokenisés.
- **Prépare un éventuel mode clair** : dans un thème light, on pourrait
  remapper `--media-frame` à `#0A0A0A` ou similaire sans toucher au
  reste du système — alors que `--bg` deviendrait `#FFFFFF` (incompatible
  avec le rôle "frame derrière média").
- **0 changement visuel** : la valeur reste `#000`, seules les
  déclarations changent (substitution `#000` → `var(--media-frame)`).

## Trigger de révision

Cette décision doit être ré-examinée quand l'un de ces évènements survient :

- Introduction d'un mode clair (le rôle frame doit-il rester `#000` ou
  basculer vers une couleur d'overlay sombre adaptée au mode clair ?)
- Apparition d'un 4ème rôle "noir intentionnel non-`--bg`" distinct de
  media-frame (séparer en `--media-frame` + `--scrim-pure` ou autre).
- Changement de stratégie sur le letterboxing (suppression du fond noir
  derrière les médias au profit d'un blur ou d'un fond ambient).
