# Plan TS — des tours restants jusqu'à TS-final

**Status:** planning. **No code changes proposed.** Document de cadrage, à
arbitrer par le mainteneur.
**Date :** 2026-05-28.

## Note de cadrage (prémisse)

Le brief demande « un plan du tour TS-9 jusqu'à TS-final ». Cette numérotation
vient du commentaire roadmap périmé de `main.ts` (qui s'arrête à TS-8). En
réalité `main.ts` est ≈ fin **TS-21** + sous-domaines infra (offline / realtime
/ mobile / analytics) — cf. audit 0.14, correction de prémisse. Ce plan couvre
donc **les tours RÉELLEMENT restants**, depuis l'état actuel jusqu'à TS-final.
J'utilise des libellés de tour mnémoniques (TS-H, TS-CSS, TS-State…) plutôt que
des numéros, pour éviter la collision avec la numérotation existante. Le
mainteneur peut les renuméroter (ex. TS-22…TS-28) au moment de graver le plan.

Les tours s'appuient sur les **Zones A-E** de l'audit 0.15 (graphe de
dépendances du couplage `index.html`) et sur les deux **Pistes** de l'ADR 0008
(vider `<script>` / extraire `<style>`).

---

## Tableau récapitulatif

| Tour | Objectif | Périmètre | Bloque sur | Critère de done | Risque |
|---|---|---|---|---|---|
| **TS-H** | Porter le harness coexistence vers les imports TS | `verification-0.12.cjs` | — (premier) | toutes les assertions actuelles passent en important `src/**` au lieu d'extraire `index.html` | Moyen — faux-verts si le portage rate une surface |
| **TS-CSS** | Extraire `<style>` → CSS bundlé Vite (ADR 0008 Piste 2) | bloc `<style>` (l. 38-6519) | — (indépendant) | `<style>` inline ≈ 0 ; CSS hashé servi sous `base` ; pas de FOUC mesuré | Faible — CSS pur, révertable trivialement |
| **TS-State** | `DEFAULTS` + état initial → TS ; sécuriser le mirror `state` (Zone A) | `DEFAULTS` (10335), global nu `state` | TS-H | parité lecture/écriture `state` inline↔TS sur N mutations ; 0 divergence d'état | Élevé — racine data, shadow `let state` |
| **TS-Boot** | `initSupabase` + `checkAuth` + `postAuthFlow` + `__bootDefer` (Zone B) | séquence de boot inline | TS-H, TS-State | `sb-ready` une seule fois ; 2 hydratations attachées 1× chacune ; ordre boot préservé | Élevé — invariant boot-order historiquement buggé |
| **TS-Helpers** | ≈25 domain helpers injectés dans `_buildDeps()` (Zone C) | `filterVisibleEvents`, `computePhase`, `parseMedia`, … | TS-State | chaque `_buildDeps` ne lit plus aucun `window.X` legacy ; builders vidés | Faible-Moyen par helper |
| **TS-Auth** | Îlot auth/onboarding/PIN/WebAuthn (Zone D) | `enterApp`, `updatePinDots`, PIN, onboarding, badges | TS-H, TS-Boot | `wireAuthHooks` + `registerAuthLifecycleHooks` retirés (plus de no-op silencieux) | Élevé — sessions, lifecycle |
| **TS-Handlers** | Triage des 80 handlers inline + 35 générés (Zone E) | attributs `on*` | (aucun ; trigger-driven) | **PAS « jusqu'à 0 »** — uniquement les handlers avec déclencheur réel | Variable, par cas |
| **TS-final** | Retirer les derniers ponts `window.X` ; `<script>` inline → bootstrap seul | `main.ts` + résidu `<script>` | tous les précédents | `<script>` inline = `__bootDefer` + listener load uniquement ; `main.ts` = imports + register, ≈0 pont | Moyen — nettoyage final |

---

## TS-H — Portage du harness coexistence

**Périmètre fermé.** *Dedans* : refondre `verification-0.12-runtime-coexistence.cjs`
pour qu'il **importe** les modules TS (`src/features/detail/lifecycle.ts`,
`src/features/calendar/*`, account-menu, PIN) au lieu d'extraire les fonctions
par parsing de texte d'`index.html`. *Dehors* : toute migration de fonction
métier ; aucun changement de comportement applicatif.

**Pré-requis.** Aucun — c'est le premier tour. Justification : l'ADR 0008
(§ « Impact smoke tests ») établit que le harness extrait aujourd'hui ses cibles
depuis `index.html`. Toute migration ultérieure (TS-Boot, TS-Auth) **casserait
silencieusement** cette extraction. Le harness doit pouvoir tester du TS avant
qu'on migre le testé.

**Critères d'arrêt explicites.**
- Les ≥168 assertions actuelles passent en mode « import TS ».
- Pour chaque surface déjà couverte (calendar week-drag/resize, month-drag,
  account menu, detailOverlay, eventModal/inspiModal/roleModal ESC + backdrop,
  PIN keyboard), l'assertion teste le module TS, pas une chaîne extraite.
- Un test de non-régression prouve que supprimer une fonction d'`index.html`
  (déjà migrée) ne fait PAS chuter le compte d'assertions.

**Smoke tests à écrire AVANT.** Le harness EST le smoke test ; le méta-test à
ajouter : « le harness importe `src/**` et NON `fs.readFileSync('index.html')` »
(assertion structurelle sur la méthode du harness elle-même).

**Plan de rollback.** Le harness est un fichier de test isolé (`docs/architecture/`).
Revert = restaurer la version extraction-`index.html`. Aucun impact runtime app.

---

## TS-CSS — Extraction du bloc `<style>` (ADR 0008 Piste 2)

**Périmètre fermé.** *Dedans* : déplacer le contenu de `<style>` (l. 38-6519)
vers `src/styles/app.css` (découpage par domaine à arbitrer, cf. ADR 0008),
importé depuis `main.ts`. *Dehors* : toute rationalisation CSS (tokens typo de
l'ADR 0004, hard-codes) — extraction *à l'identique*, 0 changement de valeur.

**Pré-requis.** Aucun (indépendant des pistes JS). Peut tourner en parallèle de
n'importe quel autre tour.

**Critères d'arrêt explicites.**
- `<style>` inline d'`index.html` ≈ 0 (sauf critical-CSS si retenu).
- CSS servi en `/Deggzy-Team/assets/app.<hash>.css` (base respecté).
- `sw.js` cache le nouvel asset hashé (vérifier la stratégie de cache + bumper
  `CACHE_VERSION`).
- Pas de FOUC perceptible (mesure requise — cf. point « à arbitrer » ADR 0008).

**Smoke tests à écrire AVANT.**
- Parité de style calculé : sur ~10 sélecteurs clés (`.btn`, `.list-row`,
  `.modal`, `.detail-overlay`, `.cal-event`, `.dash-release`), `getComputedStyle`
  identique avant/après extraction.
- Captures avant/après des 5-10 écrans de référence (comme posé tour 13).
- Test FOUC : premier paint sur réseau throttlé + SW vide.

**Plan de rollback.** Ré-inliner `app.css` dans un `<style>`. 1 fichier, 0
logique. Trivial.

---

## TS-State — `DEFAULTS` + état initial (Zone A, racine data)

**Périmètre fermé.** *Dedans* : déclarer `DEFAULTS` + l'hydratation initiale de
l'état en TS (`src/data/`), supprimer le `queueMicrotask` de wiring (main.ts
935), garantir que le mirror `defineProperty(window,'state')` reste l'unique
source. *Dehors* : la logique de merge/persistence (déjà en TS).

**Pré-requis.** TS-H (le mirror `state` n'est pas couvert par le harness actuel
— il faut une assertion d'état AVANT de toucher la racine).

**Critères d'arrêt explicites.**
- Aucun `let state` / `var state` global nu réintroduit dans `index.html`
  (sinon shadow du getter — risque audit 0.14).
- `DEFAULTS` n'existe plus inline ; `window.DEFAULTS` fourni par TS si encore lu.
- Parité : après N mutations inline (`state.todos.push(...)`), `getState()` TS
  reflète exactement, et inversement.

**Smoke tests à écrire AVANT.**
- « 100 mutations alternées inline/TS, divergence = 0 » (sur le modèle du test
  50-cycles listener-delta).
- `DEFAULTS` deep-equal entre l'ancienne valeur inline et la nouvelle valeur TS.
- Cold boot (localStorage vide) → état hydraté depuis DEFAULTS, identique
  avant/après.

**Plan de rollback.** Ré-déclarer `DEFAULTS` inline + restaurer le
`queueMicrotask`. Le pont `defineProperty` reste compatible avec les deux formes.

---

## TS-Boot — Séquence de boot (Zone B)

**Périmètre fermé.** *Dedans* : `initSupabase` → TS (fournir `sb` directement au
lieu de `window.sb` + `sb-ready`), `checkAuth`, `postAuthFlow` ; simplifier la
double hydratation `sb-ready` (audit 0.14 P4) en un point. *Dehors* :
`__bootDefer` + listener `load` (restent inline — s'exécutent pendant le parse).

**Pré-requis.** TS-H + TS-State (le boot lit l'état).

**Critères d'arrêt explicites.**
- `sb-ready` n'est plus nécessaire OU émis exactement 1× avec 1 seul abonné.
- `checkAuth` cold (pas de session) et warm (session restaurée) testés.
- L'ordre `__bootDefer` (état dispo avant le travail différé) est préservé —
  aucun `ReferenceError` boot (cf. historique git « defer … ReferenceError »).

**Smoke tests à écrire AVANT.**
- Séquence de boot : phases dans l'ordre, `window.state` défini avant le premier
  `__bootDefer` qui le lit.
- Hydratation Supabase : `setSupabaseClient` appelé exactement 1×, que `sb` soit
  prêt avant ou après l'attache du listener (les deux courses).
- `checkAuth` × {cold, warm, session expirée} → état UI attendu.

**Plan de rollback.** Restaurer `initSupabase` inline + les 2 hydratations
event-driven. Pont `sb-ready` re-câblé. Tour entièrement révertable.

---

## TS-Helpers — Domain helpers des `_buildDeps()` (Zone C)

**Périmètre fermé.** *Dedans* : migrer les ≈25 helpers injectés
(`filterVisibleEvents`, `isTodoOnDashboard`, `computePhase`, `getCurrentRoleKey`,
`parseMedia`, `tagChipsHTML`, `getSplitsArray`, `_stampEventUpdate`,
`_eventTooltip`, `_entityMatchesTagFilter`, …) vers les modules render/feature
TS, et vider les `_build*Deps()` correspondants dans `main.ts`. *Dehors* : les
side-effects hooks (animateCounter, attachSwipeDelete — UI, migrent ailleurs).

**Pré-requis.** TS-State (les helpers lisent `state`).

**Critères d'arrêt explicites.** Par helper : le `_buildDeps` ne lit plus
`window.<helper>` ; l'import est direct dans le module render. Done global :
au moins un `_buildDeps` entièrement supprimé (preuve que le rétrécissement de
`main.ts` est mécaniquement enclenché).

**Smoke tests à écrire AVANT.**
- Pour `filterVisibleEvents` (sécurité visibilité privée) : un event `private`
  d'un autre acteur N'apparaît PAS dans le rendu dashboard/calendar — test
  explicite, car le fallback `|| events` du builder masquerait sa disparition
  (audit 0.14, risques).
- Pour `computePhase` : la phase calculée à une date donnée est identique
  avant/après migration (table de dates → phases attendues).

**Plan de rollback.** Restaurer le helper inline + le fallback du builder (qui
re-lit `window.X`). Granularité fine = rollback par helper.

---

## TS-Auth — Îlot auth / onboarding / PIN / WebAuthn (Zone D)

**Périmètre fermé.** *Dedans* : `enterApp`, `updatePinDots`, `haptic` (UI),
`signInUser`/`signOutUser` (couche email-lockout + loading UI), WebAuthn
auto-trigger, onboarding steps + badges ; retirer `wireAuthHooks` +
`registerAuthLifecycleHooks` quand leurs cibles sont TS. *Dehors* : la crypto
PIN + orchestrateurs (déjà TS-11).

**Pré-requis.** TS-H (PIN keyboard est couvert SC22-24 — doit tester le TS) +
TS-Boot (postAuthFlow, session).

**Critères d'arrêt explicites.**
- `wireAuthHooks` ne reste plus que pour les concerns réellement transverses,
  ou est retiré.
- Aucun callback de hook n'est un no-op silencieux (audit 0.14, risques) — chaque
  cible existe en TS.
- Logout : teardown realtime channel → delta de listeners = 0 (pas de fuite de
  channel).

**Smoke tests à écrire AVANT.**
- PIN keypad : SC22-24 portés sur le module TS (digits, gate `offsetParent`,
  modifiers).
- `enterApp` : try/catch/finally — une exception post-`enterApp` ne laisse pas
  l'écran verrouillé (régression historique phase 8).
- Logout : ouvrir realtime → logout → `removeChannel` appelé, channels = null,
  listener delta = 0.
- Onboarding : navigation steps avant/arrière, idempotence des binders
  (data-* déjà testée 0.5-0.9).

**Plan de rollback.** Restaurer l'îlot inline + ré-enregistrer `wireAuthHooks` /
`registerAuthLifecycleHooks` (les hooks tolèrent l'absence via `typeof`).

---

## TS-Handlers — Triage des handlers inline (Zone E)

**Périmètre fermé.** *Dedans* : UNIQUEMENT les handlers avec un déclencheur réel
(bug, audit a11y, perf). *Dehors* : tout le reste. **Ce tour n'est PAS « migrer
jusqu'à 0 »** — le triage 0.13-T5 a explicitement rejeté ce complétionnisme, et
l'audit 0.10 l'a identifié comme la dérive principale (« inertie de série »).

**Pré-requis.** Aucun structurel ; piloté par un déclencheur observé.

**Critères d'arrêt explicites.** Le déclencheur précis est résolu. Pas
d'objectif de compte. Les catégories G/H/I/L du triage 0.13-T5 (DOM-forward,
stopPropagation, backdrop, interpolation dynamique) **restent inline**
(meilleures ainsi).

**Smoke tests à écrire AVANT.** Selon le handler migré : binding survit à un
re-render (pattern 0.7), idempotence, pas de double-fire.

**Plan de rollback.** Restaurer l'attribut `on*` inline + retirer le binder.
Réversibilité triviale (démontrée 0.5-0.9).

---

## TS-final — Nettoyage terminal

**Périmètre fermé.** *Dedans* : retirer les derniers ponts `window.X` devenus
sans appelant, réduire le `<script>` inline au bootstrap (`__bootDefer` +
listener `load`), réduire `main.ts` à : imports + `register*` + listeners infra
(error, SW, analytics). *Dehors* : tout ce qui a encore un appelant inline.

**Pré-requis.** Tous les tours précédents (un pont ne part qu'avec son appelant).

**Critères d'arrêt explicites.**
- `<script>` inline d'`index.html` = bootstrap seul (≈ qq dizaines de lignes).
- `main.ts` : plus aucun `window.X = tsFn` de pont métier (restent : `window.App.*`
  si encore lu, handlers error, register).
- Les 8 `defineProperty(window, …)` retirés (plus de lecture inline des globals
  nus `state`, `_currentUser`, …).

**Smoke tests à écrire AVANT.** Suite complète du harness TS (TS-H étendu à
toutes les surfaces) verte ; boot cold + warm ; un parcours utilisateur complet
(login → PIN → dashboard → calendar drag → detail → logout) sans `window.X`
métier résiduel.

**Plan de rollback.** Chaque retrait de pont est un commit isolé révertable. Pas
de big-bang (ADR 0008, alternative B rejetée).

---

## Dépendances inter-tours

```
                 TS-H ──────────────┐ (pré-requis test de TOUT ce qui est testé)
                  │                 │
       ┌──────────┼─────────┐       │
       ▼          ▼         │       ▼
   TS-State    (TS-CSS)     │   TS-Boot
       │       indépendant  │       │
       ├───────────┐        │       │
       ▼           ▼        │       ▼
  TS-Helpers    TS-Boot ◄───┘   TS-Auth
       │           │                │
       └─────┬─────┴────────────────┘
             ▼
        TS-Handlers (trigger-driven, hors chemin critique)
             │
             ▼
         TS-final  ◄── (suppose TOUS les précédents)
```

Lecture :
- **TS-H d'abord** : sans lui, migrer une fonction testée rend le harness
  faux-vert (ADR 0008).
- **TS-CSS isolé** : aucune dépendance, peut tourner quand on veut (idéal en
  parallèle, faible risque).
- **TS-State est la racine data** : débloque TS-Helpers et TS-Boot.
- **TS-Boot + TS-Auth** sont le cœur risqué (boot-order + sessions) — à faire
  après que le harness les couvre en TS.
- **TS-Handlers** est latéral, jamais sur le chemin critique, jamais par
  complétionnisme.
- **TS-final** ne fait que retirer ce que les autres ont rendu orphelin.

---

## Ce que ce plan ne fait PAS

- ❌ Ne donne **aucune** estimation en heures/jours (vocabulaire « tours »).
- ❌ Ne grave **pas** la numérotation (TS-H… est mnémonique ; renuméroter au
  besoin).
- ❌ Ne tranche **pas** les points « à arbitrer » de l'ADR 0008 (FOUC, découpage
  CSS, markup).
- ❌ Ne fixe **pas** d'objectif « 0 handler inline » (anti-pattern 0.10/0.13-T5).
- ❌ Ne décide **pas** de lancer ces tours — c'est au mainteneur.
