# Night session LOG — Préparation TS-final (audit only)

**Mode :** audit / planification, lecture seule du code source. Écriture
restreinte à `docs/architecture/` et `docs/decisions/`. Aucun commit, aucune
branche, aucun `npm install`/`build`.

Format : append-only, horodaté UTC. Rapport au mainteneur à son réveil.

---

## 2026-05-28T01:12Z — Début de session

Contexte lu dans l'ordre du brief :
- `package.json` — scripts `dev` (vite), `build` (`tsc --noEmit && vite build`),
  `preview`, `verify` (harness coexistence `.cjs`). devDeps : typescript ^5.4.5,
  vite ^5.2.11. `"Phase TS migration in progress"`.
- `tsconfig.json` — `strict: true`, `noImplicitAny`, `strictNullChecks`,
  `noImplicitReturns`, `noFallthroughCasesInSwitch`, `isolatedModules`,
  `noEmit`. `noUnusedLocals/Parameters: false`. Bundler resolution, ES2020.
- `vite.config.ts` — `base: '/Deggzy-Team/'` (GitHub Pages subpath), entry HTML
  = `index.html` à la racine, Vite ne bundle que les `<script type="module"
  src>`, laisse les `<script>` inline et `<style>` intacts. `sourcemap: true`.
- ADRs lus : 0001 (accent, format de référence), 0004 (typo *deferred* —
  pattern "décision de NE PAS faire"), 0007 (media-frame token, récent).
- Audits lus : 0.10 (réversibilité / rigidité émergente — discipline
  "signals only, not prescriptions"), 0.11 (matrice lifecycle runtime —
  risque `body.overflow`), triage 0.13-T5 (107 `onclick` inline restants),
  finding 0.13-T4 (ESC/outside-click modals existent déjà), verification 0.12
  (harness coexistence, 168 assertions, TS-1 a extrait App.Runtime).

### Découverte d'incohérence éditoriale (à arbitrer par le mainteneur)

Le brief impose le **français** pour le style éditorial. Or les audits existants
dans `docs/architecture/` (0.10, 0.11, finding/triage 0.13, verification 0.12)
sont rédigés en **anglais**, tandis que les ADRs de `docs/decisions/` (0001-0007)
sont en **français**. Il y a donc deux conventions linguistiques selon le
répertoire.

**Tranché provisoirement** : je suis l'instruction explicite du brief (français)
pour les 4 livrables, MAIS je conserve les conventions structurelles des audits
(en-tête `Status:`, ton observational, tableaux, section reproducibility, section
"ce que l'audit ne recommande PAS"). Cela crée une rupture de langue avec les
audits anglais voisins.

**À arbitrer au réveil** : soit (a) garder l'anglais pour `architecture/` par
cohérence avec l'existant et ne mettre en français que l'ADR 0008, soit (b)
acter le français comme langue cible et re-traduire les audits anglais dans un
tour ultérieur. Je ne tranche pas cette question éditoriale globale.

## 2026-05-28T01:30Z — Lecture code source terminée

Fichiers lus intégralement : `src/main.ts` (1891 l.), `src/core/boot.ts`,
`src/core/runtime.ts`, `src/core/instrumentation.ts`. Survol structurel de
`src/features/*` et `src/render/*` (179 fichiers `.ts` au total). Analyse
statique de `index.html` (14 469 l.) par grep.

### Découverte 1 — Le brief sous-estime l'avancement réel (premise correction)

Le brief demande « ce qui reste dans `src/main.ts` à la fin du tour TS-8 ».
Or `main.ts` est très au-delà : le commentaire d'en-tête (l. 10-22) liste
TS-0→TS-8 puis « TS-9+ modals, auth, calendar ; TS-final HTML decomposition »,
mais le corps du fichier contient déjà TS-9 (modals), TS-10/11 (auth), TS-12
(data + render dispatch), TS-13C (calendar render), TS-14A-D (tous les
renderers), TS-15 (budget/plan/kpi/catalogue/profile), TS-16 (calendar runtime
drag), TS-17→TS-21 (audio store / pill / cache / player / tracks), plus des
sous-domaines non numérotés TS : OFFLINE-1, REALTIME-1, MOBILE-1, ANALYTICS-1.

**Le commentaire de roadmap en tête de `main.ts` est périmé.** Je rédige les
livrables contre l'état RÉEL du dépôt (≈ fin TS-21 + sous-domaines infra), pas
contre la prémisse « fin TS-8 » du brief. Conséquence directe sur le Livrable 1 :
il n'audite pas « le résidu post-TS-8 » mais « l'état actuel de la couche-pont ».

**À arbitrer** : mettre à jour le commentaire roadmap de `main.ts` (modif de
`src/` — donc HORS de mon périmètre cette nuit). Je le signale, je n'y touche pas.

### Découverte 2 — Le risque `body.overflow` du 0.11 a migré (et semble traité)

L'audit 0.11 plaçait le risque d'`body.style.overflow='hidden'` non restauré
en cas d'exception dans `openDetail()` à `index.html:L16903`. Aujourd'hui :
`grep body.style.overflow index.html` → **0 occurrence**. La logique a migré
vers `src/features/detail/lifecycle.ts` (l. 213/233/242) qui documente en
en-tête un chemin de rollback (restore overflow + remove `.open` + rethrow).
La verification 0.12 (SC11) confirme ce rollback sous coexistence. Le risque
structurel n°1 du 0.11 paraît donc **adressé** par la migration TS-6.

### Découverte 3 — ADR 0001 et 0004 : les comptes cités ne tiennent plus

- ADR 0001 dit « 28 hard-codes `rgba(10,132,255,X)` dans `<style>` ». Aujourd'hui :
  `rgba(10, 132, 255` → **0**, et `rgba(var(--accent-rgb)` → **64**. La
  « rationalisation couleurs » que l'ADR 0001 posait comme future est donc
  FAITE. L'ADR 0001 n'a pas été mis à jour pour le refléter (toujours `accepted,
  temporary`).
- ADR 0004 dit « 109 occurrences `font-size: Npx` ». Aujourd'hui : **249**. Le
  bloc CSS a beaucoup grossi (index.html est passé de ~9900 à 14 469 lignes). La
  dette typo non traitée est ~2,3× plus grande que ce que l'ADR documente.

Ces deux écarts sont des observations factuelles, pas des actions. Consignés
pour le Livrable 2.

### Découverte 4 — Collision de numérotation potentielle (0.14 / 0.15)

Le brief impose les noms `audit-0.14-*` et `audit-0.15-*`. Or la
`verification-0.12-runtime-coexistence.md` utilise déjà « 0.14 » et « 0.15 »
comme jalons internes du harness (ajout de scénarios, fix du typo detailPane).
Les noms de fichiers ne se chevauchent pas littéralement (jalons ≠ docs), mais
le ré-emploi des numéros peut prêter à confusion à la relecture. Je respecte
les noms du brief ; je signale le doublon sémantique. À arbitrer : renuméroter
en 0.24/0.25 pour suivre la séquence du harness, ou garder 0.14/0.15.

### Métriques relevées (pour les livrables)

- `index.html` : 14 469 l. — 1 bloc `<style>` (l. 38-6519, ~6481 l.), 1 bloc
  `<script>` inline (l. 7594-14454, ~6860 l.), markup HTML ~1110 l., 1 `<script
  type=module src=/src/main.ts>` (l. 14467), 1 CDN Supabase (l. 21).
- Handlers inline dans `index.html` : onclick 59, onchange 10, onsubmit 7,
  onblur 4 = **80**. (Le triage 0.13-T5 comptait 107 onclick — la baisse vient
  surtout de la migration des templates render vers `src/render/` : 35 `onclick`
  vivent désormais dans les modules TS.)
- `main.ts` : ~113 affectations `window.X =` / `(window as …)`, 34 appels
  `register*` (dont 13 `registerSectionRenderer`), 10 fonctions `_build*Deps()`,
  8 `Object.defineProperty(window, …)`, 6 `addEventListener` (sb-ready ×2,
  keydown pin, error, unhandledrejection), 2 `queueMicrotask`, 1 SW register.

## 2026-05-28T01:23Z — Livrables terminés

Les 4 livrables sont écrits + ce LOG. Aucun fichier source touché (vérifié
`git status` : 5 fichiers neufs dans `docs/`, rien dans `src/`/`index.html`/
configs).

- `docs/architecture/audit-0.14-main-ts-residue.md` — inventaire de la
  couche-pont `main.ts` par bloc + 4 patterns + risques + ce qui peut/ne peut
  pas être extrait sans toucher `index.html`.
- `docs/architecture/audit-0.15-index-html-coupling.md` — topographie des 2
  monolithes, 80 handlers inline + 35 générés en TS, surface `App.*`, écarts ADR
  0001/0004, clôture du risque 0.11 `body.overflow`, 5 zones A-E ordonnées.
- `docs/decisions/0008-html-decomposition-plan.md` — ADR draft `proposed`,
  stratégie « vider, pas découper » (2 pistes) + 3 alternatives honnêtes +
  conséquences (base GH Pages, hashing Vite, **harness à porter**).
- `docs/architecture/plan-ts-9-to-final.md` — 8 tours (TS-H → TS-final) avec
  périmètre fermé / pré-requis / critères d'arrêt / smoke tests à écrire AVANT /
  rollback + diagramme de dépendances ASCII.

### Hésitations laissées au mainteneur (non tranchées, par discipline)

1. **Langue des audits** : FR (instruction brief) vs EN (audits existants).
   Tranché provisoirement FR ; arbitrage global à faire.
2. **Numérotation 0.14/0.15** : doublon sémantique avec les jalons du harness
   `verification-0.12`. Noms du brief conservés ; renuméroter (0.24/0.25 ?) au
   besoin.
3. **Commentaire roadmap périmé** de `main.ts` (annonce TS-9+ comme futur alors
   que TS-21 est fait) : signalé, pas corrigé (serait une modif de `src/`).
4. **Chiffres périmés ADR 0001 (28→0 rgba) et 0004 (109→249 font-size)** :
   observés, non corrigés (décision éditoriale).
5. **Points « à arbitrer » de l'ADR 0008** : FOUC (critical-CSS vs link complet),
   découpage du CSS (mono vs par domaine), sort du markup `<body>`.
6. **Pré-requis dur identifié** : le harness `verification-0.12.cjs` extrait ses
   cibles depuis `index.html` par parsing texte → doit être porté vers des
   imports TS (tour TS-H) AVANT toute migration de fonction testée, sinon
   faux-verts silencieux. C'est le point le plus conséquent du lot.

### Découverte technique notable (bug latent potentiel)

Le mirror `defineProperty(window,'state')` (main.ts:1875) a un fallback `catch`
qui, si l'inline ré-introduisait un `let state`, laisserait l'app tourner sur
**deux états divergents** avec un simple `console.warn`. Non couvert par le
harness. Documenté comme risque dans audit 0.14 + smoke test proposé dans
TS-State. Pas un bug actif aujourd'hui (pas de `let state` inline), mais un
piège pour une future régression.

## 2026-05-28T01:23Z — Fin de session

**Résumé (5 lignes) :**
1. 4 livrables + LOG produits en lecture seule ; 0 fichier source modifié.
2. Prémisse du brief corrigée : `main.ts` est ≈ fin TS-21, pas TS-8 (roadmap
   header périmé) — les livrables visent l'état réel.
3. `main.ts` est une couche-pont (113 `window.X`, 34 register, 10 buildDeps)
   qui rétrécit avec le `<script>` inline ; elle ne « finit » pas seule.
4. Le risque `body.overflow` du 0.11 est clos côté HTML (migré en TS + testé) ;
   en échange, le harness lui-même devient le prochain point dur (TS-H).
5. 6 hésitations laissées au mainteneur + 1 bug latent (`state` shadow) ; aucun
   tour lancé, aucune décision gravée — terrain préparé, arbitrage au réveil.
