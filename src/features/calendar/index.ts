// ============================================================================
// Calendar runtime — barrel. Phase TS-16.
//
// Single entry point: register deps once via registerCalendarRuntime(deps).
// Attach functions stay individually importable for the section renderer.
// ============================================================================

import type { CalendarDeps } from './types';
import { registerWeekDragDeps } from './week-drag';
import { registerWeekResizeDeps } from './week-resize';
import { registerMonthDragDeps } from './month-drag';
import { registerInteractionsDeps } from './interactions';

export type { CalendarDeps, CalendarEvent, WeekDragState, WeekResizeState, MonthDragState } from './types';
export {
  HOUR_HEIGHT_PX,
  WEEK_START_HOUR,
  RESIZE_SNAP_MIN,
  MOVE_SNAP_MIN,
  DRAG_THRESHOLD_PX,
  snapWeekMoveMins,
  snapWeekResizeDuration,
  movedPastThreshold,
} from './preview';

export { attachWeekInteractions, attachCalendarInteractions } from './interactions';
export { onWeekEventPointerDown, _getWeekDragState, _resetWeekDrag } from './week-drag';
export { onWeekEventResizeDown, _getWeekResizeState, _resetWeekResize } from './week-resize';
export { onCalEventPointerDown, _getMonthDragState, _resetMonthDrag, isMonthDragStarted } from './month-drag';

/** Wire all calendar runtime sub-modules to the same deps. Call once at boot. */
export function registerCalendarRuntime(deps: CalendarDeps): void {
  registerWeekDragDeps(deps);
  registerWeekResizeDeps(deps);
  registerMonthDragDeps(deps);
  registerInteractionsDeps(deps);
}
