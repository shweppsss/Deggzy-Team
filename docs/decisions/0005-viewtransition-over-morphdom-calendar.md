# ADR 0005 — viewTransition over morphdom for calendar grid

- **Status** : Accepted
- **Date** : 2026-05-21
- **Tour** : 19 V2
- **Stack** : H4 innerHTML wave 2

## Context

`src/render/calendar/grid.ts` reconstruit toute la grille calendar à chaque render
via deux `grid.innerHTML = html` (week + month). Wave 1 H4 (commit `69d269c`) a
wrappé 30 mounts hors-calendar avec `viewTransition()` du helper
`src/features/mobile/transitions.ts`. Pour la Wave 2, deux stratégies étaient
candidates pour les 2 innerHTML calendar :

1. **morphdom** — diff DOM fin avec `getNodeKey: node => node.dataset.eventId`
   pour préserver les pills et animer les déplacements.
2. **viewTransition** — cross-fade global via View Transitions API, cohérent
   avec Wave 1.

## Decision

**viewTransition** (option C1). morphdom est écarté.

## Rationale

- **Mode de pensée du sous-système** : `renderWeekViewInternal` /
  `renderMonthViewInternal` redessinent la grille en bloc à chaque tick
  (changement de semaine, sync realtime, drag commit). C'est une **transition
  entre deux états globaux**, pas un diff fin.
- **Surface technique de morphdom** : trois problèmes non-triviaux à résoudre
  pour un bénéfice non-visible sans CSS supplémentaire :
  1. Choix `cloneNode` vs string-wrappée pour passer un fragment HTML
  2. Idempotence des hooks `attachWeekInteractions` / `attachMonthInteractions`
     (listeners doublés si nodes préservés)
  3. Stabilité d'un `data-event-id` sur chaque pill (à vérifier dans
     `buildWeekView` / `buildMonthView`)
- **Bénéfice morphdom invisible sans CSS** : sans animation CSS sur position
  des pills, `getNodeKey` ne produit pas d'effet visuel. Triple câblage requis
  pour un gain marginal.
- **Cohérence avec Wave 1** : un helper unique, un mental model unique. Pattern
  Apple-native (Calendar.app, Fantastical) = cross-fade sur changement de vue.
- **Brief design figé** : Apple-style, glassmorphism. Cross-fade s'aligne.
  Smooth move morphdom-style n'est pas dans les refs.
- **Zéro install** : pas de surface d'attaque mentale supplémentaire dans
  un outil interne déjà dense.

## Consequences

- **Positif** : pattern unifié H4, zéro dépendance ajoutée, brief Apple-aligned.
- **Neutre** : cross-fade au lieu de move sur drag d'une pill d'un jour à l'autre.
  Sémantiquement défendable (l'évent change de "place", cross-fade le signale).
- **Reportable** : si un jour le besoin "smooth move des pills" devient explicite,
  cette décision peut être revisitée. Re-trigger probable : design system R.I.C.H
  posé + un membre du studio signale que la transition calendar lui manque.

## Related

- ADR 0001 (accent gravé)
- ADR 0002 (scrim + glass-edge)
- ADR 0003 (radius)
- ADR 0004 (typo deferred)
- Wave 1 H4 viewTransition wrap, commit `69d269c`
- Helper `viewTransition()` : `src/features/mobile/transitions.ts`
