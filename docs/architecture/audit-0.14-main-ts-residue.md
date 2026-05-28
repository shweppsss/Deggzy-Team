# Audit 0.14 — Résidu de `src/main.ts`

**Status:** observational. **No code changes proposed.**

**Méthode :** lecture intégrale de `src/main.ts` (1891 lignes) + des 3 modules
`src/core/*`, recoupée par grep sur `index.html`. Aucun code muté.
**Date de l'audit :** 2026-05-28.

---

## Correction de prémisse (à lire avant l'inventaire)

Le brief 0.14 demande « ce qui reste dans `main.ts` à la fin du tour TS-8 ». Le
commentaire de roadmap en tête de `main.ts` (l. 10-22) entretient cette idée :
il s'arrête à `TS-8 ← current PR` et annonce `TS-9+` comme futur.

**Ce commentaire est périmé.** Le corps de `main.ts` câble déjà, par leurs
propres marqueurs de section : TS-9 (modals), TS-10/11 (auth local + réseau),
TS-12 (data + render dispatch), TS-13C (calendar render), TS-14A-D (tous les
renderers de section), TS-15 (budget/plan/kpi/catalogue/profile), TS-16
(calendar runtime drag/resize), TS-17→TS-21 (audio store / pill / cache /
player / tracks CRUD), et les sous-domaines infra OFFLINE-1, REALTIME-1,
MOBILE-1, ANALYTICS-1.

Cet audit décrit donc **l'état réel de `main.ts` ≈ fin TS-21**, pas un résidu
post-TS-8. La distinction change la nature de l'objet : `main.ts` n'est pas
« du legacy qui traîne », c'est **la couche-pont délibérée** entre les modules
TS et le `<script>` inline encore présent dans `index.html`. La question utile
n'est pas « qu'est-ce qui reste à extraire de `main.ts` » mais « quelle part de
`main.ts` pourra DISPARAÎTRE quand les appelants inline de `index.html` seront
migrés ». La taille de `main.ts` est une fonction décroissante de la taille du
`<script>` inline.

---

## Inventaire

Regroupé par bloc fonctionnel. Les catégories suivent celles du brief, affinées
au contact du fichier. La colonne « Supprimable quand » remplace « Migrable
vers » : presque rien dans `main.ts` n'est à *déplacer* — l'essentiel est du
*pont* à *retirer* une fois l'appelant inline parti.

| Lignes | Symbole / bloc | Catégorie | Dépendances | Supprimable quand |
|---|---|---|---|---|
| 24-248 | `import { … }` (≈30 modules TS) | infra-imports | modules `src/**` | jamais (c'est l'entrée Vite) — restera, mais se réduira |
| 253-375 | `declare global { interface Window … }` | glue-window-app (types) | tous les ré-attachements ci-dessous | quand le dernier `window.X` est retiré |
| 379-387 | `window.App.{Runtime,Boot,Instrumentation}` | glue-window-app | core/* | quand l'inline n'appelle plus `App.Runtime.*` (11 sites inline) |
| 396-402 | `window.{ICONS,icon,hydrateIcons,EMPTY_ART,emptyState,parseDate,isFutureOrToday}` | inline-render-bridge | render-utils | quand les renderers inline résiduels importent directement |
| 408 | `window.MiniPlayer` | glue-window-app | features/mini-player | quand l'inline n'appelle plus `MiniPlayer.*` |
| 414-465 | audio store + pill builders (`getAudioState`, `subscribeAudio`, `trackAudioInitialHTML`, …) | inline-render-bridge | features/audio, /pill | quand catalogue+detail inline partent |
| 467-567 | `registerAudioCache({…})` + 16 ré-attachements cache | deps-builder + glue | features/audio/cache | deps : quand `state.tracks`/`sbDownloadBlob`/`SB_BUCKET_*` sont en TS ; glue : quand l'inline n'appelle plus `getTrackAudioUrl` etc. |
| 569-654 | `registerPlayer({…})` + 9 ré-attachements `*TS` | deps-builder + glue | features/audio/player | deps : quand `state.tracks`/`toast` en TS ; recovery via localStorage direct |
| 662-697 | détail + format + domain + event-actor ré-attachés | glue-window-app | features/detail, lib/* | quand les templates inline qui les appellent partent |
| 705-743 | modals : 13 `window.X` + 3 `defineProperty` (editingEventId, _pendingRoleKey, _inspiDraft) | glue + mutable-mirror | features/modals | quand `saveEvent`/`saveRole`/`saveInspiLink` inline migrent |
| 754-775 | `wireAuthHooks({updateDots,haptic,toast,enterApp,clearWebAuthnAutoTrigFails})` | auth-hydration | features/auth + 5 globals inline | quand updateDots/haptic/toast/enterApp sont en TS |
| 780-814 | `registerAuthLifecycleHooks({cleanupRealtimeChannels,reload,loadProfile,postAuthFlow,showResetPassword})` | auth-hydration | features/auth + globals inline + `sb` | quand realtime teardown + postAuthFlow + showResetPassword sont en TS |
| 830-837 | `_hydrateAuthClientFromWindow` + listener `sb-ready` + `queueMicrotask` | auth-hydration | `window.sb` (créé par inline `initSupabase`) | quand `initSupabase` est en TS et fournit le client directement |
| 840-908 | PIN : ré-attachements + 3 `defineProperty` (_currentUser/_currentProfile/_signOutInProgress) + `_pinBuffer` mirror + `keydown` handler + crypto/orchestrateurs | auth-hydration | features/auth | quand les flux inline signIn/handleResetPin lisent la session en TS |
| 935-963 | `queueMicrotask` : wiring `window.DEFAULTS` + `window.state` + clients Supabase data/profiles | data-bootstrap | inline `DEFAULTS`, `state`, `sb` | quand `DEFAULTS` + état initial sont déclarés en TS |
| 969-979 | `registerCloudPushHook(() => …)` | data-bootstrap | inline `pushWorkspaceToCloud` | quand le push cloud (retry/reconcile) est en TS |
| 981-1052 | `registerOffline({…})` + abonnement connectivité + ré-attachements + **enregistrement Service Worker** | deps-builder + boot-orchestration | features/offline, `pushWorkspaceToCloud`, `BASE_URL` | deps : quand push cloud en TS ; SW : reste (c'est une vraie responsabilité d'entrée) |
| 1054-1123 | `registerRealtime({…})` + `_bootRealtimeOnce` + **wrap de `window.save`** + ré-attachements | realtime-bootstrap | `sb`, `_currentUser`, `_currentProfile`, `_presence` | quand auth+presence sont entièrement TS |
| 1125-1166 | `registerMobile({…})` + ré-attachements haptics/visibility | deps-builder | features/mobile, player | deps déjà quasi pur (audioContinuity → player TS) |
| 1168-1250 | `registerAnalytics({})` + sondes (audio/offline/mobile/realtime/error) + handlers `error`/`unhandledrejection` | deps-builder + boot-orchestration | features/analytics | sondes : restent (instrumentation transverse) ; handlers error : restent |
| 1252-1289 | mirrors data (`loadWorkspaceFromCloud`, `deepMerge`, `loadState`, `loadProfileFromCloud`, `ensureProfileExists`, `saveAliasToCloud`) | glue-window-app | data/* | quand l'inline n'appelle plus ces noms |
| 1294-1832 | render dispatch : 10 `_build*Deps()` + 13 `registerSectionRenderer` + 11 `register*SideEffects/ModelBuilder/InteractionHooks/PostRouteHook/RenderFailureHook` + shims `render*TS` | deps-builder + inline-render-bridge | render/*, features/calendar, + ~25 helpers inline (filterVisibleEvents, isTodoOnDashboard, computePhase, PHASES, ROLE_BY_KEY, parseMedia, tagChipsHTML, getSplitsArray, attachSwipeDelete, animateCounter, renderRoleWidgets, …) | chaque `_buildDeps` se vide quand ses helpers inline migrent ; chaque shim `render*TS` part quand l'inline `renderX()` est supprimé |
| 1837-1867 | `window.{renderView,renderAll,requestRender,invalidateSection,save,saveImmediate,renderCalendar}` + 11 helpers dates (`_isoDate`, `_parseIso`, …) | glue-window-app | render dispatch, render/shared/dates | quand l'inline n'appelle plus `renderView()`/`save()`/`_isoDate()` |
| 1869-1886 | `Object.defineProperty(window,'state')` (getter/setter, single source of truth) + fallback `catch` | data-bootstrap (pont critique) | data/workspace | quand l'inline ne lit plus le global nu `state` |
| 1889-1890 | `void patchState; void getDirtySectionsForStateKeys` | autre (silence unused) | — | au nettoyage final |

---

## Patterns observés

### P1 — Le pont à 3 mécanismes

`main.ts` relie TS ↔ inline par exactement trois mécanismes, jamais d'autres :

1. **Ré-attachement direct** `window.X = tsFn` (≈113 sites). Pour les fonctions
   pures dont l'inline appelle le nom nu.
2. **`Object.defineProperty(window, X, {get,set})`** (8 sites). Pour les
   *bindings mutables* que l'inline lit ET écrit (`editingEventId`,
   `_currentUser`, `state`, …). Le module TS reste source de vérité ; le getter
   expose, le setter ré-injecte.
3. **`register*(deps)` + `_build*Deps()`** (34 register, 10 builders). Pour les
   modules TS qui ont besoin de helpers encore inline : on ne tire pas l'inline
   dans le module, on **injecte** l'inline dans le module via une closure
   reconstruite à chaque appel (lazy, lue sur `window`).

### P2 — Les 10 `_build*Deps()` sont structurellement identiques

Chacun suit le même squelette : `const w = window as unknown as LegacyHelpers;
return { fnA: (…) => typeof w.fnA === 'function' ? w.fnA(…) : <fallback> }`.
Le fallback (`|| events`, `|| true`, `|| ''`) garantit que le rendu TS ne casse
pas si le helper inline n'est pas encore prêt. C'est la même discipline
défensive que les binders 0.5-0.9 (cf. audit 0.10, Axe 5) — similarité
structurelle sans coût observé à ce jour, **pas** un signal d'abstraction.

### P3 — Le wrap de `window.save` (l. 1101-1107) est le seul effet de bord caché

Tous les autres ponts sont additifs et inertes. Une exception : `main.ts`
**remplace** `window.save` par une version qui appelle `_bootRealtimeOnce()`
puis l'ancien `save`. C'est le seul endroit où `main.ts` intercale du
comportement dans un chemin legacy plutôt que d'exposer une surface. À tracer :
toute future migration de `save` doit préserver ce hook de boot realtime.

### P4 — Deux hydratations event-driven dédoublées (`sb-ready`)

Le client Supabase est hydraté deux fois indépendamment depuis l'événement
`sb-ready` : une fois pour l'auth (l. 830-837), une fois pour data+profiles
(l. 956-962), chacune avec son propre `queueMicrotask` de secours pour la course
« sb déjà prêt ». Logique correcte mais dupliquée — deux abonnés au même
événement, deux gardes microtask. Observation, pas prescription.

---

## Risques de migration (ce qui peut casser silencieusement)

| Bloc | Risque silencieux si extrait sans précaution |
|---|---|
| `defineProperty(window,'state')` (1869) | Si l'inline ré-introduisait un `let state` / `var state`, il **shadow** le getter et `main.ts` perd la source de vérité. Le `catch` (1881) log un warning mais l'app continue sur deux états divergents. Invariant fragile non testé par le harness. |
| wrap `window.save` (1101) | Une migration de `save` en TS qui n'appelle pas `_bootRealtimeOnce()` désactive silencieusement le boot realtime — pas d'erreur, juste plus de présence/broadcast. |
| `wireAuthHooks` / `registerAuthLifecycleHooks` | Les 10 callbacks délèguent à des globals inline via `typeof w.X === 'function'`. Si un de ces globals est renommé/supprimé côté inline sans mettre à jour le hook, le callback devient un **no-op silencieux** (PIN sans haptique, logout sans teardown realtime → fuite de channel). |
| `_build*Deps()` fallbacks | Les fallbacks (`|| events`, `|| true`) masquent l'absence d'un helper : un rendu « marche » mais avec des données non filtrées (ex. `filterVisibleEvents` absent → tous les events affichés, fuite de visibilité privée). Aucun bruit. |
| `sb-ready` double hydratation | Si le séquencement boot change (ex. `initSupabase` synchrone avant le module), les deux `queueMicrotask` peuvent rater l'événement déjà émis. Le commentaire l. 820-829 documente précisément le bug historique de ce type. |
| ré-attachements `window.X` | Ordre : le module est `defer`, donc s'exécute après le parse inline mais l'inline TOP-LEVEL synchrone (pendant le parse) ne voit PAS encore les `window.X`. Tout appel inline à un pont depuis du code synchrone de premier niveau échouerait. Le code inline contourne via `window.__bootDefer(...)` (exécuté sur `window.load`). Migrer un de ces appels hors du `__bootDefer` ré-ouvrirait la course. |

---

## Ce qui PEUT être extrait sans toucher `index.html`

- **Les `_build*Deps()` dont tous les helpers inline ont déjà migré.** À vérifier
  individuellement : un builder dont la closure ne lit plus aucun `window.X`
  legacy peut être remplacé par un import direct dans le module render concerné.
- **Les sondes analytics + handlers `error`/`unhandledrejection`** (1168-1250) :
  purement TS, aucune dépendance inline. Pourraient vivre dans
  `features/analytics/index.ts` plutôt que dans `main.ts`.
- **L'enregistrement Service Worker** (1044-1052) : aucune dépendance inline,
  pourrait être un module `core/sw-register.ts`.
- **La double hydratation `sb-ready`** pourrait être factorisée en un seul
  point — mais cela reste dans `main.ts` (pont), donc « extraction » interne.

## Ce qui REQUIERT la décomposition HTML d'abord

- **Tous les ré-attachements `window.X = tsFn`** : par définition ils existent
  *parce qu'*un appelant inline lit `X`. Ils ne disparaissent qu'avec l'appelant.
- **Les 3 `defineProperty` de session** (`_currentUser` etc.) et **le mirror
  `state`** : ils existent parce que l'inline lit/écrit ces globals nus. Tant que
  le `<script>` inline manipule `state` / `_currentUser`, le pont reste obligatoire.
- **`wireAuthHooks` / `registerAuthLifecycleHooks`** : dépendent de
  `enterApp`, `updatePinDots`, `postAuthFlow`, `initSupabase` — tous inline.
- **Le `queueMicrotask` DEFAULTS/state** (935) : dépend de `window.DEFAULTS`
  déclaré inline (l. 10335) et du séquençage `__bootDefer`.

**Conclusion de section :** `main.ts` ne peut pas « finir de migrer » seul. Son
rétrécissement est piloté par la décomposition de `index.html` (objet du
Livrable 2 et de l'ADR 0008). L'ordre est : vider l'inline → retirer le pont
correspondant dans `main.ts`. Jamais l'inverse.

---

## Ce que cet audit ne recommande PAS

- ❌ Ne recommande **pas** de factoriser les 10 `_build*Deps()` en un helper
  générique. Similarité structurelle sans coût observé (même discipline que
  l'audit 0.10, Axe 5). Le déclencheur serait un premier bug copié dans
  plusieurs builders — non observé.
- ❌ Ne recommande **pas** de supprimer des ré-attachements `window.X`
  proactivement « parce qu'ils ont l'air dead ». Chacun a (peut-être) un
  appelant inline ; le triage appartient au Livrable 2 / aux tours TS-9+.
- ❌ Ne recommande **pas** de fusionner la double hydratation `sb-ready` dans ce
  PR. Le dédoublement fonctionne ; la fusion est cosmétique sans déclencheur.
- ❌ Ne tranche **pas** la mise à jour du commentaire roadmap périmé de
  `main.ts` (ce serait une modif de `src/`, hors périmètre).

---

## Reproducibility

```bash
# Inventaire des ponts window.X
grep -nE "window\.[A-Za-z_]+ =|\(window as" src/main.ts | wc -l

# Les deps-builders
grep -nE "^function _build[A-Za-z]+\(" src/main.ts

# Les register* (injection de deps)
grep -oE "register[A-Z][A-Za-z]+\(" src/main.ts | sort | uniq -c

# Les mirrors mutables
grep -nE "Object\.defineProperty\(window" src/main.ts

# Vérifier que body.overflow a bien quitté l'inline (cf. audit 0.11)
grep -nE "body\.style\.overflow" index.html      # attendu : 0
grep -rnE "body\.style\.overflow" src/features/detail/lifecycle.ts
```
