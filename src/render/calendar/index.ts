// ============================================================================
// Calendar render — barrel. Phase TS-13C.
// ============================================================================

export type { CalendarEvent, CalendarActor, CalendarDeps, ConflictsMap } from './types';

export {
  OVERLOAD_THRESHOLD,
  RECURRENCE_HORIZON_DAYS,
  eventsOverlap,
  detectEventConflicts,
  expandMultiDay,
  stepRecurrence,
  expandRecurrence,
  expandEventsForWindow,
} from './calculations';

export {
  assignLanes,
  laneCount,
  type LaneAssignment,
} from './lanes';

export {
  weekChipGeometry,
  weekEventChipHTML,
  monthEventChipHTML,
  type WeekChipGeometry,
} from './event-chip';

export {
  buildWeekView,
  type WeekViewOpts,
  type WeekViewResult,
} from './week';

export {
  buildMonthView,
  type MonthViewOpts,
  type MonthViewResult,
} from './month';

export {
  createDragGhost,
  moveDragGhost,
  removeDragGhost,
  sweepDragGhosts,
  markDropTarget,
  clearDropTargets,
  _liveGhostCount,
} from './drag-preview';

export {
  renderCalendarView,
  registerCalendarInteractionHooks,
  type CalendarInteractionHooks,
} from './grid';
