# Finding 0.13 T4 — Modal ESC + outside-click handlers already exist

**Status:** observational correction to the 0.11 audit. **No code change to `index.html`.**

## Brief

T4 of the 0.13 task list asked for ESC + outside-click on `eventModal`, `roleModal`, `inspiModal`.

## Discovery

While preparing the implementation, a grep revealed that **all three modals already have both ESC and outside-click handlers** in the legacy code. The 0.11 audit row that labeled them "No doc listener attached" was incomplete — it counted only doc listeners attached **inside each modal's own code paths**, and missed the shared global listeners that handle them all.

## What actually exists today

### ESC (L17740-L17764, global keydown listener)

```js
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  // Respect input focus — don't kill user typing with a misfire
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
    active.blur();
    return;
  }
  const eventModal = document.getElementById('eventModal');
  const inspiModal = document.getElementById('inspiModal');
  const roleModal  = document.getElementById('roleModal');
  if (eventModal && eventModal.classList.contains('open') && typeof closeEventModal === 'function') {
    closeEventModal(); return;
  }
  if (inspiModal && inspiModal.classList.contains('open') && typeof closeInspiModal === 'function') {
    closeInspiModal(); return;
  }
  if (roleModal && roleModal.classList.contains('open') && typeof closeRoleModal === 'function') {
    closeRoleModal(); return;
  }
  // ...detail pane fallback...
});
```

All three modals get ESC. The listener also respects input focus (blurs first, then a second ESC closes the modal).

### Outside-click

Two implementations (legacy inconsistency, but both work):

**eventModal + inspiModal** — L17721-17725, document delegate:
```js
document.addEventListener('click', (e) => {
  if (e.target.id === 'eventModal' && typeof closeEventModal === 'function') closeEventModal();
  else if (e.target.id === 'inspiModal' && typeof closeInspiModal === 'function') closeInspiModal();
});
```

**roleModal** — L7231, inline HTML attribute on the modal-bg element:
```html
<div class="modal-bg" id="roleModal" onclick="if (event.target === this) closeRoleModal()">
```

Both achieve the same behavior (backdrop click closes the modal). The mechanism differs.

## Correction to 0.11 audit

The 0.11 audit matrix row 5 / 6 should read:

> `eventModal` / `roleModal` / `inspiModal` — ESC + outside-click handled by shared
> document listeners (L17721 for outside-click on eventModal+inspiModal; L17740 for ESC
> on all three) and an inline handler on roleModal (L7231) for outside-click.
> No per-modal lifecycle code, but the behavior IS present.

The audit's "UX gap" claim was wrong. The gap was in the audit's coverage, not in the product.

## T4 outcome

**No code change.** The behavior the brief asked for already exists in the legacy.

### What this PR contains

- This finding document.
- Zero modification to `index.html`.

### What was considered but rejected

- Moving `roleModal`'s outside-click from inline to the document delegate (cosmetic homogenization). Per the discipline established across 0.5-0.12 ("no refactor for symmetry without an observed problem"), this is not done.
- Adding a runtime smoke test for these handlers similar to the 0.12 harness. The harness is for cross-zone lifecycle coexistence; for individual modal ESC/outside-click, the legacy behavior has been working without incident — no observed problem signals a need.

## Reproducibility

```bash
# Verify ESC handler covers all 3 modals
grep -n 'closeEventModal\|closeRoleModal\|closeInspiModal' index.html | head

# Verify outside-click delegate
grep -nE "e\.target\.id === '(event|inspi)Modal'" index.html

# Verify roleModal inline outside-click
grep -n 'closeRoleModal()' index.html | head
```
