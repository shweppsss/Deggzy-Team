# ADR 0001 — Accent color

**Date** : 2026-05-21
**Status** : accepted, temporary
**Tour** : 12

## Décision

L'accent color du design system est le bleu système Apple :

| Variable | Valeur |
|---|---|
| `--accent` | `#0A84FF` |
| `--accent-rgb` | `10, 132, 255` |
| `--accent-soft` | `rgba(10, 132, 255, 0.14)` |
| `--accent-hover` | `#409CFF` |

Déclaration dans `:root` d'`index.html`, lignes 62–65.

## Contexte

- L'app Deggzy-Team est un outil interne pour l'album R.I.C.H (release
  2026-09-11).
- Le design system cible une esthétique Apple Music / [untitled] :
  glassmorphism, fond noir, single-accent expressif sur palette neutre.
- L'audit CSS tour 11 a confirmé que cette couleur était déjà câblée 28
  fois en hard-code dans le bloc `<style>` d'`index.html` (sous forme
  `rgba(10, 132, 255, X)`), et que les variables `--accent*` étaient
  déjà définies dans `:root` avec les bonnes valeurs depuis le clone
  initial du repo.

## Alternatives considérées

- **A — Couleur signature R.I.C.H** : poser une couleur distinctive
  liée à l'univers visuel de l'album, qui serait ensuite étendue à la
  pochette / Instagram / merch. Rejetée pour ce tour : aucune
  identité visuelle R.I.C.H n'est encore posée, l'accent serait choisi
  arbitrairement.
- **C — Couleur thématique réversible** : accent qui change selon le
  projet artistique. Reporté à un futur où plusieurs projets coexistent.

## Conséquences

- **Inertie respectée** : l'app reste alignée avec sa stack actuelle
  (fonte système Apple, palette `--sys-*` iOS, glass Apple-style).
- **Première brique visuelle posée** : tout autre choix d'accent
  réveillera des incohérences avec les `rgba(10,132,255,X)` hard-codées
  partout (à substituer par `rgba(var(--accent-rgb), X)` dans un futur
  tour "rationalisation couleurs").
- **Status temporaire explicite** : cette décision est à re-trancher
  quand l'identité visuelle R.I.C.H sera posée. Le coût de migration
  est minimal (1 ligne à changer dans `:root`, propagation automatique
  via `--accent-rgb`), sous réserve d'avoir préalablement substitué les
  hard-codes.

## Trigger de révision

Cette décision doit être ré-examinée quand l'un de ces évènements survient :
- Pochette R.I.C.H validée
- Identité visuelle Deggzy posée formellement (logo, palette de marque)
- Lancement public de l'app au-delà de l'équipe interne
