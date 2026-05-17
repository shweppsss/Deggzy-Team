# Audit 0.10 — Reversibility & emerging rigidity

**Status:** observational. This document produces **signals only**, not prescriptions.
None of the findings below should be read as "therefore X must be removed / abstracted / refactored".
The audit measures what the project would have to live with if it chose to change direction — it does not propose a direction.

**Scope:** all 4 infra additions (0.1–0.4) and all 5 micro-migrations (0.5–0.9) currently merged on `main`.
**Method:** static analysis via `grep` / `awk` on `index.html`. No code mutated.
**Date of audit:** 2026-05-17.

---

## Axis 1 — Legacy functions: real callers vs symbolic compat

For each legacy function kept "intact for backward compatibility" by a migration, count of **real programmatic callers** in `index.html`. "Real" excludes: the function definition itself, comments, and the migration's own binder (which routes click → legacy fn by design — that's the migration's plumbing, not a pre-existing caller).

| Function | Migration | Real callers (location) | Binder routes here? | Observation |
|---|---|---|---|---|
| `toggleAuthPassword` | 0.5 | **0** | No — the 0.5 binder re-implements the logic inline rather than routing | Function is currently unreferenced anywhere |
| `onboardingNext` | 0.6 | **1** (`signUpUser`, L10101 — for "Enter pressed mid-step") | Yes (L10929-30) | One genuine external caller; binder additionally routes |
| `onboardingBack` | 0.6 | **0** | Yes (L10931-32) | No external caller |
| `onboardingRemoveSkill` | 0.7 | **0** | Yes (L10876) | No external caller |
| `toggleAccountMenu` | 0.8 | **0** | Yes (L16646) | No external caller |
| `hideAccountMenu` | 0.8 | **6** (`disablePinOnThisDevice` L13909; internal closes at L16553, L16585, L16592, L16614, L16655) | No — binder doesn't call this | Genuinely re-used as a public close-API of its own subsystem |
| `onboardingAddSkill` | 0.9 | **0** | Yes (L10803, L10821 — both binders route) | No external caller |

### Signals (not prescriptions)

- 5 of 7 functions have **no real external caller** today. The "legacy compat" preserved for them is currently symbolic.
- 2 of 7 functions are genuinely used as external surfaces: `onboardingNext` (1 caller, the form-submit handler) and `hideAccountMenu` (multiple internal + external callers — it's effectively a public API of the menu subsystem).
- Symbolic-compat ≠ dead. A 0-caller function may still serve as:
  - a documented surface that a future feature could call,
  - a mental frontier between "user-facing UI surface" and "binder plumbing",
  - a debugging aid (callable from DevTools),
  - a fallback path if the binder is ever disabled.
- The audit does **not** infer "therefore remove the 5 symbolic-compat fns". It only records that they exist as symbolic-compat today.

### Caller distinction matters

- **Functions still legitimately referenced** even without the binder system: `onboardingNext`, `hideAccountMenu`.
- **Functions whose only references are the binder system + their own definition + comments**: the other 5.

---

## Axis 2 — `data-*` attributes: real consumer diffusion

For each `data-*` attribute introduced by a migration, full count of consumers across all categories (HTML, CSS, JS, comments).

| Attribute | HTML attr usage | CSS selectors | JS reads (dataset.X) | Comments | External / cross-binder usage? |
|---|---|---|---|---|---|
| `data-toggle-target` | 3 (buttons) | **0** | 1 (its own binder L10981) | 2 | **No** |
| `data-toggle-bound` | 0 (runtime-set) | **0** | 2 (its own binder L10980/10993) | 2 | **No** |
| `data-onboarding-action` | 6 (buttons) | **0** | 1 (its own binder L10924) | 3 | **No** |
| `data-onboarding-nav-bound` | 0 (runtime-set) | **0** | 2 (its own binder L10923/10935) | 3 | **No** |
| `data-skill-remove-index` | 1 (template) | **0** | 1 (its own binder L10871) | 4 | **No** |
| `data-skill-remove-bound` | 0 (runtime-set) | **0** | 2 (its own binder L10870/10878) | 1 | **No** |
| `data-skill-add` | 1 (button) | **0** | 0 (binder uses selector only) | 5 | **No** |
| `data-skill-add-bound` | 0 (runtime-set) | **0** | 2 (its own binder L10801/10805) | 1 | **No** |
| `data-skill-add-on-enter` | 1 (input) | **0** | 0 (binder uses selector only) | 3 | **No** |
| `data-skill-add-enter-bound` | 0 (runtime-set) | **0** | 2 (its own binder L10815/10823) | 1 | **No** |
| `data-account-menu-toggle` | 1 (chip) | **0** | 0 (binder uses selector only) | 3 | **No** |
| `data-account-menu-bound` | 0 (runtime-set) | **0** | 2 (its own binder L16641/16648) | 2 | **No** |

### Signals

- **0 CSS selectors target any of these 12 attributes.** None has become a styling contract.
- Every `dataset.X` read in JS is **inside the binder that owns the attribute**. No cross-binder, no cross-feature consumption.
- The risk GPT flagged — "déplacer la rigidité du JS inline vers la structure DOM" — has not materialized yet. Each attribute is a private contract between one binder and the markup it owns.
- Caveat: this state is fragile. A single future PR that introduces a CSS selector like `[data-toggle-bound] { … }`, or a cross-binder `qsa('[data-skill-add]')` from outside the original binder, would silently start the rigidity. The current absence is observation, not architectural protection.

---

## Axis 3 — Mount points: lifecycle dependence

| Mount point | Binders attached | Real lifetime alignment |
|---|---|---|
| `showAuthView()` (L10739/10742/10748/10749) | 4: `bindAuthPasswordToggles`, `bindOnboardingNav`, `bindOnboardingAddSkill`, `bindOnboardingSkillInputEnter` | All 4 wire elements that exist statically in the DOM from page load. They are **not** created by `showAuthView`. Calling the binders on every transition is idempotent and harmless, but the lifetime of the bound elements is "page load → page unload", not "auth transition". The mount placement is convenient, not lifecycle-aligned. |
| `_renderOnboardingSkills()` (L9976) | 1: `bindOnboardingSkillRemove` | The bound elements (chip × buttons) are **created** by this function. Lifetime alignment is exact. |
| `enterApp()` (L10687) | 1: `bindAccountMenuToggle` | The bound element (#userChip) is static in DOM but only becomes interactive once the user is signed in. The 0.8 placement is closer to lifecycle than to convenience. |

### Signals

- `_renderOnboardingSkills` is the **only mount point where lifetime alignment is precise** (binder runs exactly when bound elements appear). It's also the only one of the three where the binder *must* run after the mount point (otherwise the new chips have no handlers).
- The 4 binders attached to `showAuthView` are functionally correct but **could equally well run from any other point** in the app lifecycle, since the elements they bind exist from page load. `showAuthView` is the convenient hook, not the necessary one.
- `enterApp` is somewhere in the middle: not strictly necessary, but more aligned than `showAuthView` would be (the chip is only meaningful post-auth).
- Observation: the difference between "mount point is the natural lifecycle" and "mount point is the most convenient hook" is real and currently asymmetric across the 6 binders. The audit does not infer "therefore move binders X, Y to a new mount". It only records the asymmetry.

---

## Axis 4 — Document-level listeners: coexistence and isolation

Document-level listeners present in `index.html` (not including those attached and detached transiently during interactions like drag-drop):

| Line | Event | Owner | Pattern |
|---|---|---|---|
| L7994 | click | List-row delegation (legacy) | Persistent |
| L9195 / L11295 / L14821 | visibilitychange | Tab visibility hooks (legacy + notifications) | Persistent |
| L10641 / L17721 | keydown | Global keydown (PIN keypad guard + other) | Persistent |
| L13364-67 / L13499-502 / L13716-19 | pointermove/up/cancel/keydown | Calendar drag/drop/resize | Transient (attached only during drag, detached on release) |
| L16265 | paste | Clipboard handler | Persistent |
| L16599 / L16611 | click (`{once:true}`) | 0.8 account menu outside-click | Lifecycle (attached on open, auto-detaches on fire) |
| L16604 | keydown | 0.8 account menu ESC | Lifecycle (attached on open, detached on close) |
| L17703 / L17711 | click | Other (delegations / handlers) | Persistent |
| L17697 | DOMContentLoaded | hydrateIcons bootstrap | One-shot |

### Signals

- The 0.8 account-menu listeners (L16599-L16604-L16611) are **not the first** document-level listeners in this app — they joined an existing population of ~10+ persistent listeners. The "multiplication of document-level listeners" GPT flagged as a future risk is already present in the legacy code (pre-0.x).
- 0.8 listeners are also the **only ones in the file with strict lifecycle attach/detach symmetry** verified by smoke (39 assertions ensuring delta=0 after 50 cycles). The other ~10 persistent listeners have not been audited for symmetry.
- The audit does **not** infer "therefore audit all legacy document listeners". It records that the 0.x additions are currently the cleanest entries in the population.
- The order-of-fire question (would one overlay close another?) is not testable from grep alone — it would require runtime interaction testing across overlays. No conclusion offered here.

---

## Axis 5 — Duplication: similarity vs observed cost

### Structural similarity

The 6 binders share a common preamble:
```js
var R = (typeof window !== 'undefined' && window.App && window.App.Runtime) || null;
var <items> = R ? R.qsa('<selector>') : Array.from(document.querySelectorAll('<selector>'));
<items>.forEach(function (el) {
  if (el.dataset.<flag> === '1') return; // idempotent
  // …per-binder body…
  el.dataset.<flag> = '1';
});
```

This preamble is present in **6 of 6** binders.

### Observed cost of this duplication

| Symptom | Observed? |
|---|---|
| Same bug copy-pasted into multiple binders (and then fixed in only one) | **No** |
| Divergent behavior between binders that should be consistent | **No** |
| Maintenance pain reported (e.g., needing to update preamble across all 6 in one PR) | **No** |
| Onboarding pain (new contributor couldn't read one binder without reading all 6) | **Not observable** — no new contributor has touched these files |
| Inability to reason locally about one binder | **No** — each binder is ≤25 lines, self-contained |

### Signals

- The similarity is **structural**, not behavioral. Each binder routes a different event, uses a different selector, sets a different flag, and (when applicable) implements a different predicate (e.g., the Enter-key predicate in 0.9 is unique to that binder).
- No symptom of the costs that would justify abstraction has been observed yet. Per the discipline "abstractions must pay an observed problem, not an anticipated one", there is no trigger from this axis.
- Caveat: this can change quickly. A single future bug requiring a 6-place fix would convert this from "similarity" to "observed cost".

---

## Axis 6 — Cultural / pattern rigidity

This axis measures the rigidity that lives **outside the code** — in commit messages, PR descriptions, review conventions, and the implicit "what a migration PR looks like" expectation.

### What has stabilized across 0.5 → 0.9

The 5 micro-migration PRs all share the following non-code structure:

| Pattern element | Present in PRs |
|---|---|
| Section "Migration mechanics" listing what was inline → what is now data-* | 5/5 |
| Section "Before/after greps" with counts | 5/5 |
| Section "Explicitly NOT in this PR" with anti-pattern list | 5/5 |
| Section "Anti-framework greps" with 0-count assertions | 5/5 |
| Smoke test categorization B1..Bn with explicit IDEMPOTENCE bloc | 5/5 |
| Legacy fn preservation justification | 5/5 (even when no real caller exists) |
| Naming convention `bind<Feature><Action>` | 5/5 |
| Comment block at top of binder explaining what it deliberately is NOT | 5/5 |

### Signals

- A "migration PR template" has emerged **implicitly**, without anyone formalizing it.
- Each of the 8 pattern elements is justifiable individually. But their **cumulative presence across all 5 PRs** is the cultural rigidity GPT warned about: any future migration PR that doesn't include all 8 may now feel "incomplete" or "non-standard" — even if the migration itself is correct and minimal.
- The risk: future migrations may add scope (extra greps, extra smoke tests, extra comment blocks) just to match the template, rather than because the migration needs them.
- Counter-observation: the template has also caught real issues (e.g., the parallel-run double-execution bug in 0.2, surfaced because the template required listing what we tested). The template is not purely overhead.
- The audit does **not** infer "therefore drop the template" or "therefore formalize the template". It records that the template exists implicitly and may be acting as a quality floor (good) or as a scope ratchet (potential drift).

---

## Cross-axis observations (still signals, not prescriptions)

### O1. Reversibility of each migration today

| Migration | Files touched if reverted | Cross-binder dependencies | External consumers (CSS / other JS / tests) | Reversibility |
|---|---|---|---|---|
| 0.5 toggleAuthPassword | 1 (`index.html`) | 0 | 0 | Trivial — restore 3 inline handlers, remove binder + 4 attrs |
| 0.6 onboardingNext/Back | 1 | 0 | 0 | Trivial — restore 6 inline handlers, remove binder |
| 0.7 onboardingRemoveSkill | 1 | 0 | 0 | Trivial — restore template inline + remove binder + remove call from renderer |
| 0.8 toggleAccountMenu + ESC | 1 | 0 | 0 | **Less trivial** — must also decide whether to keep or drop the ESC feature (additive change) |
| 0.9 onboardingAddSkill + Enter | 1 | 0 | 0 | Trivial — restore 2 inline handlers, remove both binders |

Caveat: this measures **technical** reversibility on the current `main`. It does not measure cultural reversibility (would the team accept reverting?) or contextual reversibility (would the revert be safe if other features had since started depending on the migrated form?).

### O2. The asymmetry between symbolic-compat fns and real-compat fns

5 of 7 legacy fns are 0-caller; 2 of 7 are genuinely re-used. These two categories have very different reversal characteristics:
- The 5 symbolic-compat fns: removable without functional impact on `main` today.
- The 2 real-compat fns: must remain, because real callers depend on them.

This asymmetry is information. It does not say "remove the 5". It says "the 5 and the 2 are different things, even though they're labeled the same way in the migration PRs".

### O3. The `showAuthView` accumulation

`showAuthView` currently runs 4 binders. None of them must run from there — they all bind elements that exist statically. The pressure GPT flagged (showAuthView becoming a soft runtime / rebinding hub) is real but is currently a **convenience choice**, not a necessity.

The audit does not propose moving any of them. It records that the choice was convenience, and that if the convenience cost ever inverts (e.g., showAuthView starts running expensive work the binders don't need), the binders could move elsewhere without breaking their lifetime.

### O4. The protocol that doesn't exist in code

The audit checked: is there any helper function, generator, factory, or abstraction shared between the 6 binders? **No.**
And: is there any cross-reference (one binder reading another's attribute, one binder calling another's bind function, etc.)? **No.**

Code-side, the binders are 6 fully independent units. Cultural-side (Axis 6), they share an implicit protocol. The audit cannot fix or formalize the cultural side from the code — it can only note that the code-side independence is currently real.

---

## What this audit does NOT conclude

- It does **not** conclude that the 5 symbolic-compat fns should be removed.
- It does **not** conclude that `showAuthView` is overloaded.
- It does **not** conclude that the binder pattern should be abstracted or that a helper would pay its cost.
- It does **not** conclude that the implicit PR template should be formalized or dropped.
- It does **not** propose a Phase 0.11, 0.12, or any specific next step.
- It does **not** rank migrations as "good" or "bad".

It produces a snapshot. Future decisions can use the snapshot as input — they should not treat it as a recommendation.

---

## Reproducibility

All claims above can be re-derived by running:
```bash
# Axis 1 — legacy fn callers
for fn in toggleAuthPassword onboardingNext onboardingBack onboardingRemoveSkill \
         toggleAccountMenu hideAccountMenu onboardingAddSkill; do
  echo "--- $fn ---"
  grep -n "\b${fn}\b" index.html
done

# Axis 2 — data-* attributes diffusion
for attr in data-toggle-target data-onboarding-action data-skill-remove-index \
           data-skill-add data-skill-add-on-enter data-account-menu-toggle; do
  echo "--- $attr ---"
  grep -nE "\[$attr|dataset\.${attr//-/}" index.html
done

# Axis 4 — document listeners
grep -nE "document\.addEventListener\(" index.html
```

Re-running these will surface any drift in subsequent phases.
