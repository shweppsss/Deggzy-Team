# Verification 0.12 — Runtime coexistence (calendar drag + account menu)

**Status:** verification result. **NO code change to `index.html`.**

**Scope (strict, per 0.12 brief):** the 5 unverified coexistence risks listed in the 0.11 audit:

| # | Invariant under test | Must hold |
|---|---|---|
| 1 | Drag active + menu open | No unexpected detach |
| 2 | ESC during drag with menu open | Neither drag nor menu cleanup is broken |
| 3 | Outside click on menu during drag | No orphan listener |
| 4 | Drag end after menu close | Complete cleanup |
| 5 | Re-open menu after mixed interaction | Balanced listeners |

**Method:** the real lifecycle functions are extracted from `index.html` and executed in node against a mock `document` that tracks every `addEventListener` / `removeEventListener` call. The harness DOES exercise the real attach/detach paths; it does NOT exercise the visual drag (ghost positioning, drop-target detection) — those are not the subject of this verification.

**Test script:** [verification-0.12-runtime-coexistence.js](./verification-0.12-runtime-coexistence.js)
**Run:** `node docs/architecture/verification-0.12-runtime-coexistence.js`

---

## Result

**74 / 74 assertions PASS** (since 0.15 fix).

History:
- 0.12: 31/31 PASS
- 0.13 T2: 54/54 PASS (added week resize + cal-grid drag flows)
- 0.14: 70/74 PASS — surfaced a real defect (ESC didn't close detailOverlay due to a `detailPane` / `detailOverlay` id mismatch at L17766)
- 0.15: 74/74 PASS — defect fixed (1-word typo correction + removed unused `getComputedStyle` check)
- 0.16: 80/80 PASS — added SC14/15/16: each of eventModal / inspiModal / roleModal closes correctly on ESC (converts the 0.13 T4 trust into a runtime invariant)
- 0.17a: 89/89 PASS — added SC17/18/18b/18c: ESC respects focused-input/textarea/contentEditable (the global handler blurs first, doesn't close the modal until next ESC). Pins a fragile global behavior contract.

```
=== SANITY ===                                          (5/5)
=== SCENARIO 1 — drag active + menu open ===           (5/5)
=== SCENARIO 2 — ESC during drag + menu open ===       (5/5)
=== SCENARIO 3 — outside click during drag ===         (5/5)
=== SCENARIO 4 — drag end after menu close ===         (5/5)
=== SCENARIO 5 — re-open after mixed sequence ===      (3/3)
=== SCENARIO 6 — 50 alternating cycles ===             (3/3)
=== SCENARIO 7 — week resize × account menu ===        (9/9)  [added 0.13]
=== SCENARIO 8 — cal-grid drag × account menu ===      (9/9)  [added 0.13]
=== SCENARIO 9 — 30 mixed cycles across all flows ===  (5/5)  [added 0.13]
=== SCENARIO 10 — detail × menu × close menu ===       (6/6)  [added 0.14]
=== SCENARIO 11 — detail × menu × T1 exception ===     (6/6)  [added 0.14]
=== SCENARIO 12 — detail × ESC ===                     (4/4)  [added 0.14, fixed by 0.15]
=== SCENARIO 13 — detail × menu × ESC ===              (5/5)  [added 0.14, fixed by 0.15]
=== SCENARIO 14 — eventModal × ESC ===                 (2/2)  [added 0.16]
=== SCENARIO 15 — inspiModal × ESC ===                 (2/2)  [added 0.16]
=== SCENARIO 16 — roleModal × ESC ===                  (2/2)  [added 0.16]
=== SCENARIO 17 — ESC with focused input ===           (4/4)  [added 0.17a]
=== SCENARIO 18 — ESC without focused input ===        (1/1)  [added 0.17a]
=== SCENARIO 18b — ESC with focused textarea ===       (2/2)  [added 0.17a]
=== SCENARIO 18c — ESC with contentEditable ===        (2/2)  [added 0.17a]
```

Listener attach/detach operations logged across the run. Final listener count after every scenario is exactly **zero** (or 1 for SC13.e, which leaves the global ESC handler attached — that's architecturally always-on in the real product).

---

## Per-scenario findings

### Scenario 1 — Drag active + menu open

Starting a calendar drag (`pointerdown` on a week-event pill) attaches 4 document listeners (`pointermove`, `pointerup`, `pointercancel`, `keydown`). Opening the account menu mid-drag adds 2 more (`click` once+`keydown`). **None of the existing 4 drag listeners is detached** when the menu opens. The drag continues normally to its own `pointerup`, which cleans its 4 listeners.

Result: invariant **holds**. Coexistence is additive only — no unintended detach.

### Scenario 2 — ESC during drag with menu open

Both `_onWeekDragKeydown` and `_accountMenuEscapeKey` are registered as `keydown` listeners. Pressing ESC fires both:

- `_onWeekDragKeydown` calls `_cleanupWeekDrag()` → removes the 4 drag listeners
- `_accountMenuEscapeKey` calls `hideAccountMenu()` → removes the 2 menu listeners

Final state after ESC: 0 listeners. Drag is canceled. Menu is closed. Neither cleanup interferes with the other.

Result: invariant **holds**. Both handlers fire their own cleanup independently, no leak.

**UX observation (not a defect):** one ESC press cancels both interactions simultaneously. This is the current product behavior; the verification does not propose to change it. Recording it for future product reference.

### Scenario 3 — Outside click on menu during drag

Mid-drag, opening the menu adds a `click` (`{once: true}`) outside-click listener. When the user clicks somewhere outside both the menu and the chip:

- The `{once: true}` listener fires once and auto-detaches (DOM spec)
- The handler also calls `hideAccountMenu()` which detaches the menu's keydown listener

The 4 drag listeners (`pointermove`, `pointerup`, `pointercancel`, drag's own `keydown`) are **untouched** because they are distinct function references stored separately.

Final state: 4 drag listeners remain, 0 menu listeners. Drag continues to its `pointerup` cleanly.

Result: invariant **holds**. No orphan listener.

### Scenario 4 — Drag end after menu close

Sequence: open menu → close menu → start drag → end drag. After menu close, all menu listeners are gone (0). Starting the drag adds 4. Ending the drag removes 4. Final: 0.

Result: invariant **holds**.

### Scenario 5 — Re-open menu after mixed interaction

Sequence: drag start → menu open → outside click (closes menu) → drag end → menu reopen → menu close. The menu reopen attaches 1 click + 1 keydown. Close detaches both. No residue from the prior mixed interaction.

Result: invariant **holds**.

### Scenario 6 (bonus) — 50 alternating cycles

Alternating drag-start/drag-end and menu-open/menu-close for 50 iterations. Final state: 0 listeners on every event type. `_weekDrag = null`. `menuEl.hidden = true`.

Result: no accumulation, no leak, no skew across 100 attach/detach pairs.

---

## Conclusion

**The 5 coexistence risks listed in the 0.11 audit do NOT reproduce in the scenarios tested.**

All attach/detach paths are symmetric. All cleanup is called on every observed close path (pointerup, pointercancel, ESC, outside-click, toggle re-click). Listener counts return to zero after every interaction, including 50-cycle stress mixing both subsystems.

**No fix is applied.** Per 0.12 brief Cas 1: this PR contains the verification script + this report only.

---

## What this verification does NOT establish

- Visual drag behavior (ghost positioning, drop-target detection) is not exercised. The visual paths are tangential to listener-lifecycle coexistence and out of scope.
- Real-browser pointer-capture semantics (`setPointerCapture` / `releasePointerCapture`) are stubbed in the harness. Any anomaly that depends on actual pointer capture behavior would not surface here.

**0.13 T2 update:** the 2 remaining calendar flows (week resize, month-grid drag) ARE now individually tested against the account menu lifecycle. The 0.12 caveat "patterns are structurally identical to week-drag, so the conclusion is likely to extend" is replaced by direct verification (SC7, SC8). Plus SC9 stress-tests all three flows interleaved with the menu (30 mixed cycles, 4 flow types).

## 0.14 — Detail overlay × account menu (added)

T1 (PR #73) introduced a new runtime behavior on `openDetail`: an exception thrown after `body.style.overflow = 'hidden'` triggers a rollback (restore overflow + remove 'open' + rethrow). None of SC1–SC9 covered:

- coexistence between `body.overflow`-locking overlays and other runtime interactions,
- exception-rollback under coexistence,
- ordering of cleanups when multiple subsystems touch document-level state.

SC10–SC13 close that gap. Scope strict: `detailOverlay` × account menu only. No calendar. No other modals.

### SC10 (PASS) — Open detail → open menu → close menu

Confirms that closing the menu does NOT release the overflow lock. The overlay remains the sole owner of `body.style.overflow = 'hidden'`. The menu's two doc listeners detach cleanly on close, drag listeners (zero in this scenario) untouched.

### SC11 (PASS) — Open detail → open menu → T1 exception path under coexistence

Verifies the T1 catch path under coexistence:
- A second `openDetail('track', 't1')` call is made while the menu is open
- `hydrateDetailAudio` is stubbed to throw
- T1's catch must: restore `body.style.overflow = ''`, remove the overlay's `open` class, rethrow the original error
- The MENU's listeners must remain independently attached (they were attached before the second openDetail)
- After the menu is then closed normally, all menu listeners cleanly detach

All 6 assertions PASS. **The T1 rollback path is verified under coexistence.**

### SC12 / SC13 (PARTIAL FAIL) — Detail × ESC

The brief expected ESC to close `detailOverlay`. The harness shows it does NOT — see "Findings surfaced by 0.14" below.

## Findings surfaced by 0.14

### Defect: ESC does not close `detailOverlay`

**Location:** `index.html` L17766
**Mechanism:**
```js
const detailPane = document.getElementById('detailPane');
if (detailPane && getComputedStyle(detailPane).display !== 'none' && typeof closeDetail === 'function') {
  closeDetail();
}
```

The global ESC keydown handler queries `getElementById('detailPane')`. **No element with id `detailPane` exists in `index.html`.** The actual overlay element is `<div class="detail-overlay" id="detailOverlay">` (L7383). The lookup always returns null, so the branch never fires. ESC currently does NOTHING for the detail view.

**Impact on harness:**
- SC12.b ("after ESC: overlay closed") — FAIL
- SC12.c ("after ESC: body.overflow restored") — FAIL
- SC13.c ("after ESC: overlay closed") — FAIL
- SC13.d ("after ESC: body.overflow restored") — FAIL

**Correction to prior documents:**
- The 0.11 audit row that labeled `detailOverlay` "No doc listener attached" was correct in spirit (no doc listener TARGETING the actual id), but it didn't flag the legacy attempt-to-handle that uses the wrong id.
- The 0.13 T4 finding (`docs/architecture/finding-0.13-t4-modal-handlers-already-exist.md`) said ESC works "for all 3 modals" — which is correct for `eventModal`, `roleModal`, `inspiModal`. It implied (but did not explicitly claim) that ESC works for the detail view too. The new SC12 verification shows that implication was wrong.

**Fix (0.15):** corrected `getElementById('detailPane')` → `getElementById('detailOverlay')` at L17766, and replaced the `getComputedStyle(...).display !== 'none'` check with `classList.contains('open')` (the canonical signal for the overlay being open). All 4 previously-failing assertions now PASS — harness back to 74/74. The 4 assertions remain in the harness as regression tests.

---

## Reproducibility

```bash
node docs/architecture/verification-0.12-runtime-coexistence.js
```

The script extracts the lifecycle functions directly from `index.html` at run time, so any change to those functions on `main` is automatically picked up on the next re-run. If the count of assertions or the listener deltas drift after a future change, this is the signal that coexistence has been affected.
