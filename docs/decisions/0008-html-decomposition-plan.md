# ADR 0008 — Stratégie de décomposition de `index.html`

**Date** : 2026-05-28
**Status** : `proposed` (draft auto-généré en session de nuit, **à arbitrer par le mainteneur**)
**Tour** : TS — préparation décomposition (pré-TS-final)

> Cet ADR est un **brouillon**. Il propose une stratégie principale et expose
> honnêtement les alternatives, mais ne grave aucune décision. Les points
> incertains sont marqués « à arbitrer ». La décision finale appartient au
> mainteneur.

## Contexte

`index.html` (14 469 l.) est encore un quasi-monolithe : un bloc `<style>`
unique (~6481 l.) et un bloc `<script>` inline unique (~6860 l.) encadrent
~1074 l. de markup `<body>`. La migration TS a vidé l'essentiel de la *logique*
du `<script>` vers `src/**` (179 fichiers, ≈ fin TS-21), mais :

- ≈302 définitions `function` subsistent dans le `<script>` inline (auth/PIN,
  onboarding, notifications, boot, domain helpers, CRUD) — cf. audit 0.15.
- Le bloc `<style>` n'a **jamais** été touché par la migration : il reste
  intégralement inline (cf. audit 0.15, §4 : 249 `font-size` hard-codés, 64
  `rgba(var(--accent-rgb))`).
- `main.ts` est une couche-pont de ≈113 ré-attachements `window.X` (cf. audit
  0.14) dont la taille décroît avec celle du `<script>` inline.

Contraintes structurelles dures (cf. `vite.config.ts`) :
- `base: '/Deggzy-Team/'` — GitHub Pages sert depuis ce sous-chemin ; Vite
  réécrit les URLs d'assets bundlés vers ce préfixe.
- `index.html` à la racine **est** l'entrée HTML de Vite (`rollupOptions.input`).
  Vite ne bundle que les `<script type="module" src>` et laisse les `<script>`
  inline + `<style>` inline **intacts**.
- Pas de framework, pas de routeur, déploiement « legacy » GitHub Pages (push
  `main` → build Pages). Le Service Worker (`sw.js`) cache l'app ; `CACHE_VERSION`
  doit être bumpé à chaque release.

Un invariant fragile encadre tout : le `<script>` inline **s'exécute pendant le
parse HTML**, AVANT le module `defer` `/src/main.ts`. Le bootstrap `__bootDefer`
(l. 7633) diffère le travail état-dépendant sur `window.load`, après que le
module a posé `window.state`, `window.App.Runtime`, etc. (cf. audit 0.14, P1 +
risques). Toute décomposition doit préserver cet ordre.

## Décision (proposée)

**Stratégie principale proposée : « vider les monolithes, garder la coquille »
(empty-don't-split), en deux pistes parallèles indépendantes.**

`index.html` RESTE le fichier d'entrée Vite unique à la racine (contrainte
`base` + GitHub Pages). On ne le « découpe » pas en fragments ; on **réduit ses
deux blocs inline** jusqu'à un résidu minimal incompressible :

### Piste 1 — `<script>` inline → modules TS (continuation de la migration)

Poursuivre exactement ce qui se fait déjà (TS-9+) : extraire les ≈302 fonctions
inline restantes vers `src/**`, en suivant l'ordre de dépendances de l'audit
0.15 (Zone A état → B boot → C helpers → D auth → E handlers). Le `<script>`
inline converge vers un **bootstrap minimal incompressible** :

- `window.__bootDefer` + le listener `window.load` (doivent rester inline car ils
  s'exécutent pendant le parse, avant le module).
- Rien d'autre — pas de logique métier, pas de `DEFAULTS`, pas de helpers.

### Piste 2 — `<style>` inline → fichier CSS bundlé par Vite

Extraire le bloc `<style>` (~6481 l.) vers un fichier `src/styles/app.css` (ou
découpé par domaine) **importé depuis `main.ts`** (`import './styles/app.css'`).
Vite le bundle, le hashe, et injecte un `<link>` avec le `base` correct. Le
`<style>` inline d'`index.html` tombe à ~0.

Les deux pistes sont **indépendantes** : la Piste 2 ne dépend d'aucune
migration JS et pourrait être faite en un tour isolé à faible risque (CSS pur,
0 changement de logique). La Piste 1 est le long cours déjà engagé.

### Points laissés « à arbitrer » (non tranchés dans ce draft)

1. **FOUC (flash of unstyled content)** : déplacer le CSS d'inline vers un
   `<link>` bundlé introduit potentiellement un FOUC au premier paint (le CSS
   inline est appliqué pendant le parse ; un `<link>` est récupéré ensuite).
   À arbitrer : garder un *critical CSS* inline minimal (above-the-fold) +
   bundler le reste, ou accepter le `<link>` complet (Vite injecte le `<link>`
   dans le `<head>`, donc le risque est limité mais réel sur réseau lent + SW
   premier chargement). **Mesure requise avant de trancher.**
2. **Découpage du CSS** : un seul `app.css` vs découpage par domaine
   (`tokens.css`, `auth.css`, `calendar.css`, …). Le découpage par domaine
   s'aligne sur `src/render/*` mais multiplie les fichiers. À arbitrer.
3. **Markup `<body>`** : faut-il décomposer les ~1074 l. de markup (vues +
   modals + auth) ? Sans framework de templating, l'extraire impose un mécanisme
   (partials build-time, ou génération TS du markup). **Probablement hors
   périmètre TS-final** : un HTML shell avec markup statique est acceptable.
   À arbitrer si un besoin réel émerge (ex. lazy-load de vues).

## Alternatives considérées

### A — Fragments `.html` partiels importés à build-time

Découper `index.html` en partials (`partials/auth.html`,
`partials/calendar.html`, …) ré-assemblés au build via un plugin Vite
(`vite-plugin-html` ou includes). **Trade-offs honnêtes :**
- (+) Markup modulaire, alignable sur `src/render/*`.
- (−) Ajoute une dépendance de build (plugin tiers) à un projet qui revendique
  « pas de build step » historiquement et n'a aujourd'hui que `vite` + `tsc`.
- (−) Le plugin doit préserver le `<script>` bootstrap inline et l'ordre de
  parse — fragile, peu de plugins le garantissent.
- (−) Réversibilité moyenne : revenir en arrière = ré-inliner les partials.
- **Verdict draft** : surdimensionné tant que le markup (~1k l.) n'est pas un
  point de douleur observé. Rejeté pour l'instant, pas définitivement.

### B — Décomposition « en un coup » (big-bang)

Vider `<script>` + `<style>` + découper le markup en un seul gros tour.
**Trade-offs :**
- (+) Fini d'un coup.
- (−) Antithétique à toute la discipline du projet (0.5-TS-21 : micro-tours,
  réversibilité, harness vert à chaque étape). Un big-bang casse la propriété
  « chaque tour est indépendamment révertable ».
- (−) Risque maximal sur l'invariant boot-order et sur les ≈113 ponts `window.X`
  retirés simultanément.
- **Verdict draft** : rejeté. Incompatible avec la culture du dépôt.

### C — Statu quo (laisser `index.html` tel quel)

Arrêter la décomposition : accepter le monolithe HTML, continuer seulement la
migration JS quand un besoin émerge.
- (+) Coût nul, 0 risque.
- (−) Le bloc `<style>` ~6,5k l. reste non versionnable proprement, non
  bundlé/hashé indépendamment, et hors du pipeline TS.
- (−) `main.ts` reste gros (les ponts ne disparaissent pas).
- **Verdict draft** : c'est l'option « par défaut si rien n'est décidé ». La
  Piste 2 (CSS) est si peu risquée qu'elle vaut probablement mieux que le statu
  quo — mais c'est au mainteneur de trancher.

## Conséquences (de la stratégie proposée)

### Réversibilité
- **Piste 2 (CSS)** : trivialement réversible — ré-inliner le contenu de
  `app.css` dans un `<style>`. 1 fichier, 0 logique.
- **Piste 1 (JS)** : déjà éprouvée tour après tour (chaque fonction migrée est
  un commit révertable ; le pont `window.X` correspondant reste tant que
  l'appelant existe). Réversibilité = celle des tours TS existants.

### Impact `base: '/Deggzy-Team/'` (GitHub Pages)
- Le CSS bundlé hérite du `base` : Vite émet `/Deggzy-Team/assets/app.<hash>.css`
  et injecte le `<link>` correct. **Aucun risque de chemin** si le CSS passe par
  l'import Vite (et NON par un `<link href>` écrit à la main qui, lui, devrait
  inclure le base manuellement).
- Le bootstrap `__bootDefer` inline ne référence aucun asset → insensible au base.

### Impact hashing Vite
- Le CSS extrait devient hashé → **cache-busting automatique** (mieux que le
  `<style>` inline actuel, invalidé seulement par le SW). Conséquence : bumper
  `CACHE_VERSION` dans `sw.js` reste nécessaire pour l'app shell, mais le CSS
  hashé est busté indépendamment.
- À vérifier : `sw.js` doit cacher le nouveau `app.<hash>.css` (la stratégie de
  cache du SW liste-t-elle les assets hashés ? à auditer avant la Piste 2).

### Impact sur les smoke tests existants (CRITIQUE)
- La `verification-0.12-runtime-coexistence.cjs` **extrait les fonctions de
  lifecycle directement depuis `index.html` au runtime** (parsing de texte) —
  c'est explicite dans la doc du harness (« The script extracts the lifecycle
  functions directly from `index.html` at run time »).
- **Conséquence dure** : à mesure que ces fonctions migrent vers TS (Piste 1,
  Zones B/D), le harness **perd sa cible d'extraction** et ses assertions
  deviennent caduques ou fausses-vertes. Le harness doit migrer de
  « extraction depuis `index.html` » vers « import des modules TS » — c'est le
  « future TS-test runner (TS-1.x) » déjà anticipé dans la doc verification.
- **Cet ADR pose donc un pré-requis** : aucune migration de fonction
  actuellement testée par le harness (calendar drag/resize, account menu,
  detail overlay, modals ESC, PIN keyboard) ne doit partir avant que le harness
  sache la tester en TS. Détaillé dans `plan-ts-9-to-final.md`.

### Coexistence
- Le `<style>` extrait ne change rien à la coexistence runtime (CSS pur).
- Le `<script>` qui rétrécit suit la même coexistence que les tours TS déjà
  faits — pont `window.X` retiré seulement quand l'appelant inline part.

## Trigger de révision

Cet ADR (une fois éventuellement accepté) est à ré-examiner si :
- Une mesure de FOUC montre un flash perceptible → re-trancher critical-CSS vs
  link complet.
- Un besoin de lazy-load de vues émerge → reconsidérer l'alternative A (partials).
- Le harness coexistence est porté en TS-test runner → débloque la migration des
  fonctions testées.
- L'équipe décide d'introduire un framework (changerait toute la donne).

## Related

- Audit 0.14 (résidu `main.ts` — les ponts qui rétrécissent avec le `<script>`)
- Audit 0.15 (couplage `index.html` — zones A-E, ordre de dépendances)
- `plan-ts-9-to-final.md` (découpe en tours TS-9 → TS-final)
- `verification-0.12-runtime-coexistence.md` (harness à porter en TS)
- `vite.config.ts` (contrainte `base` + entrée HTML)
- ADR 0001 / 0004 (chiffres CSS périmés, cf. audit 0.15 §4)
