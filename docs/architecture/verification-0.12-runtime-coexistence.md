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

**31 / 31 assertions PASS.**

```
=== SANITY ===                                    (5/5)
=== SCENARIO 1 — drag active + menu open ===     (5/5)
=== SCENARIO 2 — ESC during drag + menu open === (5/5)
=== SCENARIO 3 — outside click during drag ===   (5/5)
=== SCENARIO 4 — drag end after menu close ===   (5/5)
=== SCENARIO 5 — re-open after mixed sequence ===(3/3)
=== SCENARIO 6 — 50 alternating cycles ===       (3/3)
```

300 listener attach/detach operations logged across the run. Final listener count after every scenario (including the 50-cycle stress) is exactly **zero**.

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
- The 3 other calendar lifecycle zones (week resize, month-grid drag) were not tested individually against the account menu. The patterns are structurally identical to week-drag (per 0.11 audit Axis 3), so the conclusion is **likely** to extend, but this is not verified. If a future signal involves resize or month-grid specifically, the harness in `verification-0.12-runtime-coexistence.js` can be extended to cover them — the script is structured to make that addition straightforward.
- Real-browser pointer-capture semantics (`setPointerCapture` / `releasePointerCapture`) are stubbed in the harness. Any anomaly that depends on actual pointer capture behavior would not surface here.

---

## Reproducibility

```bash
node docs/architecture/verification-0.12-runtime-coexistence.js
```

The script extracts the lifecycle functions directly from `index.html` at run time, so any change to those functions on `main` is automatically picked up on the next re-run. If the count of assertions or the listener deltas drift after a future change, this is the signal that coexistence has been affected.
