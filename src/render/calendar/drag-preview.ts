// ============================================================================
// Calendar render — drag preview. Phase TS-13C.
//
// Transient UI for the calendar drag ghost (the floating clone that
// follows the pointer during a drag). SIDE-EFFECT ONLY: creates DOM,
// moves DOM, removes DOM. No business logic, no state mutation, no
// listener attachment — those stay in the inline drag handlers (which
// are protected by SC1–9 + SC25–32 of the harness).
//
// PUBLIC API:
//   - createDragGhost(source, x, y) → ghost element (appended to body)
//   - moveDragGhost(ghost, x, y)    → positions the ghost
//   - removeDragGhost(ghost)        → removes one ghost from the DOM
//   - sweepDragGhosts()             → SC50 — removes ALL orphan ghosts
//   - clearDragTargets()            → removes the drop-target class
//   - markDropTarget(cell)          → tags one cell as drop-target
// ============================================================================

import { qsa, removeAll, removeClassAll } from '../shared/dom';

/** Class names — kept in one place so the inline CSS stays the source of truth. */
const GHOST_CLASS = 'cal-event-ghost';
const DRAGGING_CLASS = 'cal-event-dragging';
const DROPTARGET_CLASS = 'cal-cell-droptarget';

/**
 * Create a floating ghost from `source` (typically a clone of the dragged
 * pill). The ghost is appended to document.body so a mid-drag re-render
 * (which replaces the grid's innerHTML) doesn't destroy it.
 *
 * Position is set via fixed positioning at (x, y) — caller is expected
 * to subtract the pointer's offset within the pill so the ghost tracks
 * naturally under the pointer.
 */
export function createDragGhost(source: HTMLElement, x: number, y: number, width?: number, height?: number): HTMLElement {
  const ghost = source.cloneNode(true) as HTMLElement;
  ghost.classList.add(GHOST_CLASS);
  ghost.style.position = 'fixed';
  ghost.style.pointerEvents = 'none';
  ghost.style.left = x + 'px';
  ghost.style.top = y + 'px';
  if (width != null) ghost.style.width = width + 'px';
  if (height != null) ghost.style.height = height + 'px';
  document.body.appendChild(ghost);
  return ghost;
}

/** Move an existing ghost to the new position. No-op if ghost is null. */
export function moveDragGhost(ghost: HTMLElement | null, x: number, y: number): void {
  if (!ghost) return;
  ghost.style.left = x + 'px';
  ghost.style.top = y + 'px';
}

/** Remove a single ghost from the DOM (no-op if already detached). */
export function removeDragGhost(ghost: HTMLElement | null): void {
  if (!ghost) return;
  try { ghost.remove(); } catch (_e) { /* no-op */ }
}

/**
 * Sweep ALL ghost elements from the document. Called by renderCalendar()
 * at the top of each render pass so an interrupted drag (e.g. mid-drag
 * realtime sync) doesn't leave a stuck floating pill on screen.
 *
 * Also clears the `.cal-event-dragging` class from any source pill that
 * survived the innerHTML replace, and clears any leftover drop-target.
 *
 * SC50 pins the symmetry of this cleanup.
 */
export function sweepDragGhosts(): void {
  removeAll('.' + GHOST_CLASS);
  removeClassAll('.' + DRAGGING_CLASS, DRAGGING_CLASS);
  removeClassAll('.' + DROPTARGET_CLASS, DROPTARGET_CLASS);
}

/** Mark a cell as the current drop target. Clears the flag from siblings first. */
export function markDropTarget(cell: HTMLElement | null): void {
  removeClassAll('.' + DROPTARGET_CLASS, DROPTARGET_CLASS);
  if (cell) cell.classList.add(DROPTARGET_CLASS);
}

/** Clear all drop-target flags. */
export function clearDropTargets(): void {
  removeClassAll('.' + DROPTARGET_CLASS, DROPTARGET_CLASS);
}

/** Diagnostic — current count of live ghost elements (test hook for SC50). */
export function _liveGhostCount(): number {
  return qsa('.' + GHOST_CLASS).length;
}
