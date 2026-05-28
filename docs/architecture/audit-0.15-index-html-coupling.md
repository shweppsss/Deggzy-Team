# Audit 0.15 — Couplage `index.html` ↔ code TS migré

**Status:** observational. **No code changes to `index.html`.**

**Méthode :** analyse statique par grep + lecture des zones charnières. Aucun
code muté. **Date de l'audit :** 2026-05-28.

> Note de numérotation : la `verification-0.12-runtime-coexistence.md` emploie
> déjà « 0.14 » et « 0.15 » comme jalons internes du harness. Ce document garde
> le nom imposé par le brief mais le doublon sémantique est signalé (cf.
> `night-session-LOG.md`, découverte 4) — à renuméroter au besoin.

---

## Topographie de `index.html` (14 469 lignes)

| Zone | Lignes (approx.) | Volume | Contenu |
|---|---|---|---|
| `<head>` + CDN Supabase | 1-37 | ~37 l. | meta, CDN `supabase-js@2` (l. 21) |
| **Bloc `<style>` unique** | 38-6519 | **~6481 l.** | tout le CSS de l'app |
| Markup `<body>` | 6520-7593 | ~1074 l. | vues statiques + modals + auth |
| **Bloc `<script>` inline unique** | 7594-14454 | **~6860 l.** | ≈302 fonctions + boot + DEFAULTS |
| `<script type=module src=/src/main.ts>` | 14467 | 1 l. | l'entrée Vite (couche-pont) |

Deux monolithes (`<style>` ~6,5k l. et `<script>` ~6,9k l.) encadrent ~1k l. de
markup. La décomposition HTML « finale » concerne ces deux blocs ; le markup est
secondaire.

---

## 1. Scripts inline

Il n'y a **qu'un seul** bloc `<script>` inline (l. 7594-14454) — pas une
dispersion de petits scripts. Plus un `<script>` CDN externe (Supabase, l. 21)
et le module TS (l. 14467). Catégorisation du contenu du bloc inline :

| Catégorie | Poids | Exemples |
|---|---|---|
| **init / boot** | moyen | `window.__bootDefer` (l. 7633), `initSupabase` (8279), `checkAuth` (13636), `postAuthFlow` (9602), `renderTabbar` (10521), `refreshUserChip`, hydrateIcons bootstrap (14300) |
| **render shims (thin forwards)** | faible | `renderDashboard`/`renderTodos`/`renderCalendar`/… → `window.render*TS` (14 shims, corps réduit au forward) |
| **domain helpers non migrés** | élevé | `filterVisibleEvents` (11670), `computePhase` (10634), `parseMedia` (13069), `tagChipsHTML` (10825), `getSplitsArray` (13888), `_stampEventUpdate` (11680), `_eventTooltip`, `isTodoOnDashboard` (10759), `getCurrentRoleKey` (10720) |
| **auth / onboarding / PIN / WebAuthn** | élevé | `signInUser` (9080), `signUpUser`, `setLocalPin`, `pinTryFaceId`, WebAuthn auto-trig, `_showOnboardingStep`, `_selectOnboardingRole`, badges |
| **notifications** | moyen | `_checkDeadlinesNotifs`, `_checkMentionsNotifs`, `_checkReleasesNotifs`, `_runNotificationChecks`, `_notif*` |
| **CRUD actions** | moyen | `addTrack`, `addMember`, `addTodo`, `addTransaction`, `addSplitContrib`, `updateProfileField` |
| **realtime / presence / activity UI** | moyen | `_currentActor`, `applyPresenceDots`, `_deriveLocalActivityItems`, `renderTeamActivity` |
| **binders 0.5-0.9 (data-\* + App.Runtime)** | faible | `bindAuthPasswordToggles`, `bindOnboardingNav`, `bindAccountMenuToggle`, … (6 sites lisent `window.App.Runtime` défensivement) |
| **constantes / état** | — | `DEFAULTS` (10335), `PHASES` (11832), `PROJECT_DATE` (10598), `ROLE_BY_KEY` (10697), `ROLES` |

≈**302 définitions `function`** subsistent dans ce bloc.

---

## 2. Handlers inline sur attributs HTML

| Type | Compte | Cibles représentatives |
|---|---|---|
| `onclick` | 59 | nav/openers (`showSignIn`, `openRoleModal`, `openEventModal`, `setCalView`, `changeCalRange`), close (`closeRoleModal`), save (`saveRole`, `saveEvent`, `saveInspiLink`), DOM-forward vers input caché (`document.getElementById(...).click()` ×6), PIN (`pinTryFaceId`, `pinDelete`), `_setEventVisibility` ×2 |
| `onchange` | 10 | `handleVideoUpload` ×2, `handleAvatarUpload`, `handleInspiUpload`, `handleImport`, `onboardingHandleAvatar`, `updateProfileField`, `toggleProfileNotif`, `updateSentryDsn`, `_refreshRecurrenceUntilVisibility` |
| `onsubmit` | 7 | `signInUser`, `signUpUser`, `setLocalPin`, `sendResetEmail`, `submitNewPassword`, `saveSetup`, `event.preventDefault()` |
| `onblur` | 4 | `updateProfileField` ×3, `updateProfileSocial` |
| **Total** | **80** | — |

À recouper avec le triage 0.13-T5 (107 `onclick`). La baisse à 59 `onclick`
s'explique : la migration des templates de rendu vers `src/render/**` a déplacé
les handlers *générés par template* (catégorie F du triage : `openDetail('…',
'${id}')`, `deleteTodo('${t.id}')`, etc.). **35 `onclick` vivent désormais dans
`src/render/**`** (générés en TS, plus dans `index.html`). Le couplage n'a pas
disparu, il a changé de fichier : ces 35 handlers générés appellent toujours des
globals `window.X` au moment du clic.

---

## 3. Surface `window.App.*` attendue par le HTML

| Symbole | Sites inline réels (hors commentaires) | Fourni par `main.ts` ? |
|---|---|---|
| `window.App.Runtime` | **6** binders : l. 10054, 10071, 10127, 10183, 10243, 13799 (motif `var R = (… window.App.Runtime) \|\| null`) | ✓ `main.ts:385` |
| `window.App.Boot` | 0 site d'appel `.register/.run` inline actif (référencé en commentaires l. 7650-7656 ; les consommateurs `register/run` ne sont pas dans ce bloc) | ✓ `main.ts:386` |
| `window.App.Instrumentation` | 0 site d'appel inline (commentaire l. 7663-7667) | ✓ `main.ts:387` |

**Lecture :** seul `App.Runtime` a des appelants inline vivants (6 binders
0.5-0.9 qui l'utilisent défensivement, avec fallback `Array.from(qsa)` si absent).
`App.Boot` et `App.Instrumentation` sont exposés mais sans appelant inline actif
— surface symbolique (même catégorie « symbolic-compat » que l'audit 0.10, Axe 1).
Le contrat de séquençage est documenté l. 7605-7614 : rien n'appelle
`App.Runtime.*` *synchroniquement pendant le parse* ; le module `defer` a posé
`window.App.Runtime` avant tout appel (qui passe par `__bootDefer` / événements).

La surface `window.X` plus large (≈113 noms ré-attachés par `main.ts`,
cf. audit 0.14) est le vrai contrat de couplage, bien au-delà de `App.*`.

---

## 4. Hard-codes du bloc `<style>` — vérification des ADR 0001 et 0004

| Métrique | Valeur ADR | Valeur 2026-05-28 | Verdict |
|---|---|---|---|
| `rgba(10, 132, 255, X)` hard-codés (ADR 0001 : « 28 ») | 28 | **0** | **L'ADR ne tient plus.** La substitution vers `rgba(var(--accent-rgb), X)` est FAITE : 64 occurrences de `rgba(var(--accent-rgb)`. La « rationalisation couleurs » que l'ADR 0001 posait comme future a eu lieu. ADR 0001 toujours marqué `accepted, temporary`, non mis à jour. |
| `font-size: Npx` (ADR 0004 : « 109 ») | 109 | **249** | **L'ADR ne tient plus.** Le bloc CSS a ~2,3× plus de `font-size` hard-codés qu'au moment de l'ADR 0004 (index.html est passé de ~9900 à 14 469 l.). La dette typo *deferred* a grossi, pas diminué. |

Ces écarts ne sont pas des actions — ce sont des **dérives de documentation** :
deux ADR décrivent un état du CSS qui a changé. À arbitrer : rafraîchir les
chiffres des ADR 0001/0004, ou laisser (les ADR sont des décisions datées, pas
des tableaux de bord vivants). Je ne tranche pas.

---

## 5. Risque `body.overflow` du 0.11 — vérification

L'audit 0.11 (risque structurel n°1) plaçait `body.style.overflow = 'hidden'`
non restauré sur exception dans `openDetail()` à `index.html:L16903`.

**État aujourd'hui :**
- `grep "body.style.overflow" index.html` → **0 occurrence**.
- La logique a migré vers `src/features/detail/lifecycle.ts` (l. 213 set, 233 +
  242 restore), dont l'en-tête documente un chemin de rollback explicite
  (restore overflow + remove `.open` + rethrow). C'est la migration TS-6.
- La `verification-0.12` couvre ce rollback sous coexistence : SC11 (« detail ×
  menu × T1 exception ») PASS, et SC12/13 ont surfacé puis fait corriger le bug
  d'id `detailPane`→`detailOverlay` (fix 0.15 du harness, l. 14355 de
  `index.html` utilise bien `detailOverlay`).

**Verdict :** le risque n°1 du 0.11 n'existe plus *dans `index.html`*. Il vit en
TS, avec try/finally, et est épinglé par le harness. **Risque clos côté HTML.**

---

## Conclusion — Zones d'`index.html` à traiter avant TS-final

Classées par ordre de dépendance (la zone N+1 suppose souvent N traitée). Ce
sont des **observations de séquençage**, pas des prescriptions de tour ; le plan
de tours est dans `plan-ts-9-to-final.md`.

### Zone A — Déclaration de l'état (`DEFAULTS` + global nu `state`) — racine

`DEFAULTS` (l. 10335) et le global nu `state` sont la **racine du couplage data**.
`main.ts` installe `window.state` par `defineProperty` (source de vérité TS) et
lit `window.DEFAULTS` par `queueMicrotask`. Tant que `DEFAULTS` est déclaré
inline, le pont data ne peut pas disparaître. **Bloque** : toute migration de
section render (elles lisent `state`), tout le data-layer. À traiter en premier.

### Zone B — Séquence de boot (`__bootDefer` + `initSupabase` + `checkAuth`)

Le contrat d'ordre (module `defer` pose `window.X` ; l'inline diffère son travail
état-dépendant via `__bootDefer` sur `window.load`) est l'invariant le plus
fragile du dépôt (cf. historique des bugs boot-order dans le git log : commits
« defer … ReferenceError »). `initSupabase` (8279) crée `window.sb` + émet
`sb-ready` ; deux abonnés TS en dépendent. **Bloque** : la migration auth réseau,
la double hydratation `sb-ready`. À traiter tôt, avec un harness de séquençage.

### Zone C — Domain helpers encore injectés dans les `_buildDeps()`

≈25 helpers inline (`filterVisibleEvents`, `computePhase`, `parseMedia`,
`tagChipsHTML`, `getSplitsArray`, `_stampEventUpdate`, `_eventTooltip`, …) sont
injectés dans les modules render TS via `_build*Deps()`. Chacun migré permet de
vider le builder correspondant dans `main.ts`. **Bloque** : le rétrécissement de
la section render dispatch de `main.ts` (l. 1294-1832). Granularité fine,
faible risque unitaire.

### Zone D — Auth / onboarding / PIN / WebAuthn (le plus gros îlot inline)

Le plus grand bloc fonctionnel encore inline. `enterApp`, `updatePinDots`,
`postAuthFlow`, `signInUser`/`signOutUser` (couche email-lockout + UI loading),
WebAuthn auto-trigger, onboarding steps + badges. `wireAuthHooks` et
`registerAuthLifecycleHooks` dépendent de ces globals. **Bloque** : la
suppression des hooks auth de `main.ts`. Risque élevé (lifecycle, sessions).

### Zone E — Les 80 handlers inline + 35 handlers générés dans `src/render`

Le résidu de wiring DOM→fonction. Le triage 0.13-T5 a déjà posé la discipline :
**ne pas migrer par complétionnisme**. Beaucoup (DOM-forward vers input caché,
`event.stopPropagation`, backdrop click) sont *meilleurs inline*. Cette zone
n'est PAS un prérequis de TS-final si l'on accepte des handlers inline dans un
HTML décomposé. À traiter en dernier, au cas par cas, sur déclencheur réel.

---

## Ce que cet audit ne recommande PAS

- ❌ Ne recommande **pas** de mettre à jour les chiffres des ADR 0001/0004
  (décision éditoriale, à arbitrer par le mainteneur).
- ❌ Ne recommande **pas** de migrer les 80 handlers inline « jusqu'à 0 » — le
  triage 0.13-T5 a explicitement rejeté ce complétionnisme.
- ❌ Ne recommande **pas** un ordre de tours ici ; les zones A-E sont un graphe
  de dépendances, le plan exécutable est dans `plan-ts-9-to-final.md`.
- ❌ Ne tranche **pas** la stratégie de décomposition HTML elle-même : c'est
  l'objet de l'ADR 0008 (draft, `proposed`).

---

## Reproducibility

```bash
# Blocs style / script
grep -nE "<style|</style>|<script" index.html

# Handlers inline par type
for h in onclick onchange onsubmit onblur; do echo -n "$h "; grep -oE "${h}=\"" index.html | wc -l; done

# Handlers générés côté TS
grep -roE "onclick=" src | wc -l

# App.* sites réels (hors commentaires)
grep -nE "window\.App\.(Runtime|Boot|Instrumentation)\b" index.html | grep -v "^\s*[0-9]*:.*\*"

# Hard-codes CSS
grep -oE "rgba\(10, ?132, ?255" index.html | wc -l       # ADR 0001 : attendu 28, réel 0
grep -oE "rgba\(var\(--accent-rgb\)" index.html | wc -l  # réel 64
grep -oE "font-size: ?[0-9.]+px" index.html | wc -l      # ADR 0004 : attendu 109, réel 249

# Risque 0.11
grep -cE "body\.style\.overflow" index.html               # attendu 0
```
