// ============================================================================
// Calendar runtime — PURE math helpers for drag/drop preview. Phase TS-16.
//
// These functions are framework-free, side-effect-free, and entirely
// dependency-free. They drive snap behavior in week drag (30-min grid) and
// week resize (15-min grid).
// ============================================================================

export const HOUR_HEIGHT_PX = 56;
export const WEEK_START_HOUR = 7;
export const RESIZE_SNAP_MIN = 15;
export const MOVE_SNAP_MIN = 30;
/** Drag activation threshold in pixels — anything smaller is treated as a click. */
export const DRAG_THRESHOLD_PX = 5;

/**
 * Convert a Y-offset (relative to a week-day column's top) into a snapped
 * minutes-since-midnight value. Clamped so the start lies within
 * [WEEK_START_HOUR ... 22:30] (so a 30-min event still fits before 23:00).
 */
export function snapWeekMoveMins(
  relY: number,
  startHour: number = WEEK_START_HOUR,
  hourHeight: number = HOUR_HEIGHT_PX,
  snap: number = MOVE_SNAP_MIN
): number {
  const rawMins = (relY / hourHeight) * 60 + startHour * 60;
  const snapped = Math.round(rawMins / snap) * snap;
  return Math.max(startHour * 60, Math.min(23 * 60 - snap, snapped));
}

/**
 * Convert a Y-delta during resize into a new duration in minutes.
 * Clamps to [15 min ... 23:59 from start].
 */
export function snapWeekResizeDuration(
  startDuration: number,
  dy: number,
  startMins: number,
  hourHeight: number = HOUR_HEIGHT_PX,
  snap: number = RESIZE_SNAP_MIN
): number {
  const deltaMins = (dy / hourHeight) * 60;
  let next = startDuration + deltaMins;
  next = Math.round(next / snap) * snap;
  const maxDur = (24 * 60 - 1) - startMins;
  return Math.max(snap, Math.min(maxDur, next));
}

/** True if the pointer has moved past the drag activation threshold. */
export function movedPastThreshold(dx: number, dy: number, threshold: number = DRAG_THRESHOLD_PX): boolean {
  return Math.abs(dx) >= threshold || Math.abs(dy) >= threshold;
}
