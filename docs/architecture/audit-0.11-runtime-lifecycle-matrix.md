# Audit 0.11 — Runtime interaction lifecycle matrix

**Status:** observational. Operational triage report. **No code changes proposed.**

**Scope (strict, per 0.11 brief):** 6 zones with document-level interaction lifecycle.
1. Calendar week-event drag
2. Calendar week-event resize
3. Calendar month-grid drag
4. Account menu (0.8 migration)
5. `detailOverlay` (open/close)
6. `eventModal` (open/close)

**Method:** read of source paths, no behavioral runtime test.

---

## Matrix — the 7 brief questions, one row per zone

| # | Zone | (1) Listener ownership | (2) Cleanup location | (3) Guaranteed paths | (4) NON-guaranteed paths | (5) Attach/detach symmetry | (6) Global side effects | (7) Can interaction survive its context? |
|---|---|---|---|---|---|---|---|---|
| 1 | Calendar week drag (L13336-13466) | `_weekDrag` closure owns 4 doc listeners: pointermove, pointerup, pointercancel, keydown | `_cleanupWeekDrag()` (L13452) | pointerup ✓ / pointercancel ✓ / ESC ✓ / pre-emptive on new pointerdown if prior drag stale ✓ | None observed | **Symmetric** — 4 attach (L13364-67), 4 detach (L13456-59) | Ghost element appended to `document.body` — defensive `querySelectorAll('.cal-event-ghost').forEach(remove)` sweeps any orphan | Mid-drag `renderCalendar()` destroys source pill but ghost survives in `document.body`; cleanup sweep handles it. **No real survival** |
| 2 | Calendar week resize (L13473-13573) | `_weekResize` closure owns same 4 doc listeners | `_cleanupWeekResize()` (L13561) | pointerup ✓ / pointercancel ✓ / ESC ✓ / pre-emptive on new pointerdown ✓ | None observed | **Symmetric** | Source pill height mutated inline (`pill.style.height`) AND `.cal-event-resizing` class added. Class swept; height not explicitly reset BUT `renderCalendar()` redraws on cancel | Same — cleanup sweep + re-render handles ghost state |
| 3 | Calendar month-grid drag (L13691-13815) | `_calDrag` closure owns same 4 doc listeners | `_cleanupCalDrag()` (L13795) | pointerup ✓ / pointercancel ✓ / ESC ✓ / pre-emptive ✓ | None observed | **Symmetric** | Ghost in `document.body` + `.cal-event-dragging` class + `.cal-cell-droptarget` class. All 3 swept defensively | Same defense pattern as #1 |
| 4 | Account menu 0.8 (L16587-16660) | `_accountMenuOutsideClick` (click, `{once:true}`) + `_accountMenuEscapeKey` (keydown) | `hideAccountMenu()` (L16616) — explicit `removeEventListener` for both | toggle re-click ✓ / outside-click ✓ / ESC ✓ | None observed; covered by 39 smoke assertions including 50-cycle stress | **Symmetric** — verified by smoke (listener delta = 0 after each cycle) | None | None |
| 5 | `detailOverlay` (L16866-16930) | **No doc listener attached.** Lifecycle is imperative state mutation only | `closeDetail()` (L16924) | Every code path that calls `closeDetail()` restores `body.style.overflow` | An exception thrown by `openDetail()` AFTER L16903 (`body.style.overflow = 'hidden'`) and before a corresponding `closeDetail()` call would leave the lock in place. Runtime frequency of such an exception unknown — no observed occurrence during audit. | N/A (no listeners) | `document.body.style.overflow = 'hidden'` on open / `''` on close. `window.scrollTo(0, 0)` on open (no restore). Full re-render via `renderView()` on close | The overlay itself can't survive its context. The **body.overflow side-effect can outlive a partial open** if openDetail throws post-overflow-set |
| 6 | `eventModal` (L13826-13889) | **No doc listener attached.** | `closeEventModal()` (L13887) — single line, removes CSS class | Any code that calls `closeEventModal()` | None — no global side-effect to leak | N/A | None | None |

---

## Structural risks observed today

| Risk | Structural description | Location | Observed occurrence |
|---|---|---|---|
| Potential stale `body.style.overflow='hidden'` state if `openDetail()` exits exceptionally before a corresponding `closeDetail()` call | `body.style.overflow` is set on L16903 inside `openDetail()`. Any exception thrown between L16903 and the eventual `closeDetail()` call (including exceptions in code paths L16904-16910 of `openDetail` itself: `scrollTo`, conditional `hydrateDetailAudio` / `hydrateDetailCover`) leaves the page scroll locked until a future `closeDetail()` is invoked. The cleanup path is symmetric only on the **non-exceptional** flow. | L16866-16930 | **None observed during this audit. Runtime frequency unknown.** |

No other structurally-observable leak / asymmetry / cross-zone interaction was surfaced.

---

## Possible problems (NOT observed; would require interaction-flow testing to confirm)

| Risk | Zone | Notes |
|---|---|---|
| Could a calendar drag and an account-menu open coexist? | Cal drag + Account menu | Both use document-level listeners; no shared state. The account menu's outside-click `{once:true}` would fire on the first pointerdown after open — possibly the same pointerdown that starts a drag. Drag would proceed; menu would close. Plausibly correct, but unverified. |
| If user opens `detailOverlay` while a calendar drag is in progress (e.g. via realtime sync triggering some click handler) | Cal drag + detailOverlay | None of the cleanup paths in calendar drag call `closeDetail`, and vice versa. Independent states. Plausibly fine, unverified. |
| ESC pressed during calendar drag while `accountMenu` open | Cal drag + Account menu | Both `_onWeekDragKeydown` and `_accountMenuEscapeKey` would fire. `_onWeekDragKeydown` only acts if `_weekDrag` truthy (it is during drag). `_accountMenuEscapeKey` acts if menu open. **Both would fire.** Drag cancels AND menu closes. Probably desired UX but not specified anywhere. |
| `eventModal` / `roleModal` / `inspiModal` lack ESC + outside-click | All three modals | UX gap, not a behavioral leak. User must click the visible cancel button. |
| `detailOverlay` lacks ESC | detailOverlay | Same — UX gap |

---

## Architectural reading

Two **coexisting patterns** for runtime interaction lifecycle:

### Pattern Calendar (zones 1, 2, 3)
- `_<feature>` module-level state object (`_weekDrag`, `_weekResize`, `_calDrag`)
- 4 document listeners attached on user-gesture start (pointerdown)
- Single `_cleanup<Feature>()` function called from EVERY close path (pointerup, pointercancel, ESC, pre-emptive on new gesture)
- Defensive `querySelectorAll(...).forEach(remove)` sweeps for orphaned DOM artifacts (ghosts, classes)
- **Replicated 3 times in legacy code, with identical structure.** Already a stable convention.

### Pattern Account Menu 0.8 (zone 4)
- `{ once: true }` click listener + always-on keydown listener
- Closure handler (no module-level state object — just `menu.hidden`)
- Single `hideAccountMenu()` cleanup, called from every close path
- Verified by smoke tests (50 cycles, listener delta = 0)
- **Single instance.** Pattern is conceptually similar to Calendar but with different listener-flag semantics.

### Pattern Modal CSS-only (zones 5, 6 + `roleModal` + `inspiModal`)
- CSS class toggle only
- One global side-effect possible (`body.style.overflow` for `detailOverlay`)
- No ESC, no outside-click, no document listeners
- **Replicated 4 times in legacy code.** Different category entirely.

### Cross-pattern observations

1. The two **document-listener** patterns (Calendar and Account Menu) have **identical safety properties** when judged by attach/detach symmetry. They differ in:
   - listener flag (`{once: true}` for menu outside-click vs. plain attachment for calendar)
   - cleanup trigger (pointer end-event for calendar vs. close-action for menu)
   - state shape (heavy state object for calendar vs. minimal `menu.hidden` for menu)
   - These differences are **driven by the interaction semantics**, not by pattern divergence. A drag has a definite pointerup; a menu open has no definite "drop" gesture — it stays open until another action.

2. **No shared infrastructure between the 4 lifecycle zones.** Each defines its own state holder, cleanup function, and listener set. No `_globalLifecycleRegistry`, no `_pendingInteractions[]`. The audit checked: no cross-zone coupling exists.

3. **The Modal-CSS pattern is a different category, not a degraded version of the others.** Modals with no global side effect (`eventModal`, `roleModal`, `inspiModal`) don't have an "owned lifetime" to cleanup. `detailOverlay` does have one (body.overflow), and it's the only modal that needed and got a body-restoration path.

---

## What the audit explicitly does NOT recommend

- ❌ Does NOT recommend adding ESC to the 3 modal-CSS zones. UX gap ≠ architectural problem.
- ❌ Does NOT recommend abstracting the 3 Calendar cleanup functions into a shared `runtimeScope()` helper. They've coexisted for a long time without divergence; "similarity" still doesn't equal "observed cost" (per 0.10 Axis 5).
- ❌ Does NOT recommend migrating the Calendar drag/resize zones to a 0.8-style binder. The pre-0.x calendar pattern WORKS, and re-wiring it for symmetry-with-0.8 would risk regression in a high-value, often-used feature.
- ❌ Does NOT recommend fixing the `detailOverlay` body.overflow exception-asymmetry proactively. A try/finally would close the asymmetry; the audit records the structural observation without claiming a frequency or probability.

---

## What the audit DOES record as actionable information (for future direction-setting, not for this PR)

1. **The Calendar pattern is the legacy version of the 0.8 pattern.** If a future migration touches a third overlay/popover that needs document-listener lifecycle (e.g., a context menu, a tooltip with delayed dismiss, a dropdown), the choice will be: replicate Calendar pattern, replicate 0.8 pattern, or invent a third. The decision criterion (per 0.10 discipline) should be "what fits this specific interaction's semantics", not "what's consistent with the other binders".

2. **`detailOverlay`'s body.overflow path is the only structural exception-asymmetry in the audited set.** The current cleanup is non-exceptional-flow-only. A try/finally on `openDetail()` would make it exception-symmetric. The audit does not recommend doing this preemptively — record the structural observation.

3. **The `eventModal` / `roleModal` / `inspiModal` lack of ESC** is the only product-side UX gap the audit found. It is a product decision whether to add it, not an architecture decision. If it gets added, it should NOT be added as a "migration like 0.8" — it should be added as a feature, with its own justification.

---

## Reproducibility

```bash
# Listener locations
grep -nE "document\.addEventListener" index.html
grep -nE "document\.removeEventListener" index.html

# Cleanup functions
grep -nE "^function _cleanup" index.html

# Modal open/close functions
grep -nE "^function (open|close)[A-Z]" index.html
grep -nE "^function hide(AccountMenu|AuthScreen)" index.html

# Global side-effects
grep -nE "body\.style\.overflow" index.html
```
