# Triage 0.13 T5 — Remaining inline handlers

**Status:** classification only. **No code change to `index.html`.**
Per T5 brief: inventory + categorization. **No batch migration triggered by this PR.**

## Count

**107 inline `onclick=` handlers** remain on HTML attributes (was 115 at session start; 8 migrated across 0.5-0.9 and 0.13-T1/T3).

## Categories (with examples and approximate counts)

| # | Category | Count | Representative call sites | Migration cost estimate |
|---|---|---|---|---|
| A | **Pure-UI navigation / opener** | ~20 | `showSignIn()`, `showSignUp()`, `forgotPassword()`, `openRoleModal()`, `openEventModal()`, `openInspiLink()`, `setCalView('week')`, `setTodoFilter('done')`, `setInspiFilter('${f}')`, `setCalView('month')`, `changeCalRange(-1)`, `setTagFilter(null)` | LOW per handler (~5-10 LOC each). Static binder pattern like 0.5/0.6. **Many candidates** if a real trigger emerges. |
| B | **Pure-UI close / dismiss** | ~10 | `closeRoleModal()`, `closeEventModal()`, `closeDetail()` (6×), `dismissInstallHint()`, `closeInspiModal()` | LOW. Note: T4 finding already documented that ESC + outside-click work via shared listeners, so dedicated close buttons are arguably redundant for the ESC/click path — but they ARE the dedicated UI element for keyboard-accessibility users who don't use ESC. |
| C | **Pin keypad** (digit + delete + face-id) | 12 | `pinKeyPress('0')` … `pinKeyPress('9')`, `pinDelete()`, `pinTryFaceId()` | MEDIUM. The 10 digit buttons are a natural BATCH candidate — one binder reading `data-pin-digit` attribute would replace all 10 inline handlers. Single PR, ~30 LOC. The `pinDelete` and `pinTryFaceId` are 1-off handlers that don't fit the batch. |
| D | **Save / commit form actions** | ~6 | `saveRole()`, `saveEvent()`, `saveInspiLink()`, `addTrack()`, `addMember()`, `addTodo()`, `addTransaction()` | LOW per handler. These are "submit"-style; could migrate to `<form>` submit handlers OR data-* attributes. The form-submit path is more idiomatic but is a bigger refactor (HTML structure change). |
| E | **Auth / session actions** | ~5 | `signOutUser()`, `logoutStudio()`, `disablePinOnThisDevice()`, `resetLocalPin()`, `resetBudget()`, `requestNotificationPermission()` | LOW. Single-shot user actions, no lifecycle. |
| F | **Template-generated handlers (interpolated args)** | ~20 | `onclick="openDetail('event','${e.id}')"`, `onclick="deleteAsset('${cat}', ${i})"`, `onclick="removeSplitContrib('${tr.id}','${c.id}')"`, `onclick="toggleTodo('${t.id}'); closeDetail();"`, `onclick="playTrackInMini('${escapeHtml(t.id)}')"`, `onclick="removeProfileSkill(${i})"`, `onclick="openDetail('track','${t.id}')"`, `onclick="openDetail('phase',${idx})"`, `onclick="setTodoSort('${s.id}')"`, `onclick="deleteTodo('${t.id}')"`, `onclick="deleteMember('${m.id}')"`, `onclick="deleteTrackDetail('${t.id}')"`, `onclick="deleteInspiById('${i.id}')"` | MEDIUM-HIGH per handler. Each requires (a) modifying the template to emit `data-*` attributes, (b) a binder that reads them, (c) re-binding on every re-render (like 0.7's `bindOnboardingSkillRemove`). The 0.7 pattern works but multiplies binders. **Cost not justified without a real trigger** — these are stable. |
| G | **DOM-forwarding to hidden inputs** | 6 | `onclick="document.getElementById('signUpAvatarInput').click()"`, `onclick="document.getElementById('inspiUpload').click()"`, `onclick="document.getElementById('clipUpload').click()"`, etc. | LOW value to migrate. The pattern (visible button clicks a hidden file `<input>`) is browser-standard for styled file pickers. Migrating to a binder would replace one 1-line attribute with a 5-line binder + a data-* — net negative for readability. **Recommend leave inline.** |
| H | **No-op stop-propagation** | 5 | `onclick="event.stopPropagation()"` | LOW value to migrate. The inline form IS the minimum representation. Migrating would add overhead with no behavioral benefit. **Recommend leave inline.** |
| I | **Modal backdrop click** | 1 | `onclick="if (event.target === this) closeRoleModal()"` on `<div class="modal-bg" id="roleModal">` | LOW value to migrate. T4 finding noted that `eventModal` + `inspiModal` use a document delegate for the same behavior, while `roleModal` uses this inline form. Could harmonize, but T4 explicitly rejected cosmetic homogenization without a trigger. **Recommend leave inline until trigger.** |
| J | **Segmented control state** | 2 | `onclick="_setEventVisibility('team')"`, `onclick="_setEventVisibility('private')"` | LOW. Same pattern as set*Filter handlers (Category A). Could batch with them. |
| K | **Static unique 1-off handlers** | ~10 | `onclick="exportData()"`, `onclick="importData()"`, `onclick="onboardingClearAvatar()"`, `onclick="saveRole()"`, etc. | LOW per handler, individual evaluation. |
| L | **Variable interpolation `onclick="${onclick}"`** | 2 | (Inside a template helper that injects an external `onclick` string) | **Risk élevé** to migrate without understanding the template. The interpolation means the actual handler is determined dynamically. Migrating would require refactoring the template's API. **Not recommended.** |

## Realistic migration cost ranges

- **Lowest-cost batch candidate**: Pin keypad (Category C, 10 digit buttons via 1 binder reading `data-pin-digit`). Single PR, ~30 LOC, follows the 0.6 pattern. **Could be done immediately if there's any reason to.**
- **Pure-UI navigation/close** (Categories A + B + D + E): ~40 handlers across ~30 distinct functions. ~5-15 LOC per migration. Could be done over 10-20 PRs if there's a sustained reason. **Not recommended without observed signal.**
- **Template-generated** (Category F): ~20 handlers, but requires renderer + binder coordination per template. Each PR ~50-80 LOC. **Real cost: 15-20 PRs over multiple sessions. Not recommended without observed signal.**
- **DO NOT MIGRATE**: Categories G, H, I, L (~14 handlers). These have specific reasons to stay inline; migration is net-negative.

## What this triage records but does NOT recommend

- **Does NOT recommend "continue until 0 inline handlers".** That would be exactly the inertia-of-series drift the 0.10 audit flagged as the main risk.
- **Does NOT recommend a specific next migration target.** Each future migration should be triggered by a real, observed reason (bug, performance, accessibility audit, etc.), not by completionism.
- **Does NOT recommend the pin keypad batch** despite being the cheapest. Even the cheapest migration costs review-cycles and introduces a 12th data-* convention. It should only happen if a real trigger appears (e.g., keypad UX bug, accessibility audit demanding native button semantics).

## Stop conditions for the 0.13 series

The 0.13 task list T1-T5 is now complete:

| Task | Outcome | PR |
|---|---|---|
| T1 — detailOverlay try/finally | merged | #73 |
| T2 — extend coexistence harness to 2 calendar flows | merged | #74 |
| T3 — remove 5 legacy fns 0-caller | merged (with documented push-back on #5) | #75 |
| T4 — modals ESC + outside-click | **push-back: behavior already exists** | #76 |
| T5 — inline handler triage | **this PR** (this report) | (pending) |

**Per T5 brief's own stop condition: "T5 ne doit PAS devenir on continue jusqu'à 0 inline. Ce serait exactement le retour de l'inertie de série sous une autre forme."**

The 107 remaining inline handlers stay as-is until a concrete trigger appears.

## Reproducibility

```bash
# Total count
grep -c 'onclick="' index.html

# All inline handlers with line numbers (for manual category sampling)
grep -nE 'onclick="[^"]+"' index.html

# Top-N most-frequent inline handler names
grep -oE 'onclick="[a-zA-Z_]+' index.html | sort | uniq -c | sort -rn | head -20
```
