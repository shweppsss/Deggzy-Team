// ============================================================================
// Calendar runtime — types. Phase TS-16.
//
// Drag/drop + resize for the week & month calendar views were ~360 lines of
// inline JS. This module owns them with a clean DI surface so the runtime
// has zero `window.X` references in /src/features/calendar/.
// ============================================================================

/** Minimal shape of an event from `state.events` that the runtime mutates. */
export interface CalendarEvent {
  id: string;
  date: string;        // ISO yyyy-mm-dd
  time?: string;       // "HH:mm" or undefined for all-day
  duration?: number;   // minutes
  [key: string]: unknown;
}

/** Side-effect host the runtime needs. Injected once via registerCalendarRuntime. */
export interface CalendarDeps {
  /** Find an event by id (or null if it was deleted by a concurrent sync). */
  findEvent: (id: string) => CalendarEvent | null;
  /** Stamp updatedBy/updatedAt on a mutated event (no-op-safe). */
  stampEventUpdate: (ev: CalendarEvent) => void;
  /** Persist current state (Supabase + IDB). */
  save: () => void;
  /** Re-render the calendar grid (week or month). */
  renderCalendar: () => void;
  /** Re-render the dashboard upcoming list. */
  renderDashboard: () => void;
  /** Toast a confirmation message. */
  toast: (msg: string) => void;
  /** Optional haptic pulse (no-op on desktop). */
  haptic?: (ms: number) => void;
  /** Open the event detail modal (used when no drag occurred). */
  openDetail: (kind: 'event', id: string) => void;
  /** Open the create-event modal pre-filled at a given date. */
  openEventModal: (date: string) => void;
  /** Pre-fill the time field after openEventModal. Optional. */
  prefillEventTimeHour?: (hour: number) => void;
}

// -- Internal drag state shapes -------------------------------------------

export interface WeekDragState {
  id: string;
  pill: HTMLElement;
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  ghost: HTMLElement | null;
  started: boolean;
  targetDate: string | null;
  targetMins: number | null;
}

export interface WeekResizeState {
  id: string;
  pill: HTMLElement;
  handle: HTMLElement;
  pointerId: number;
  startY: number;
  startDuration: number;
  startMins: number;
  currentDuration: number;
  cancelled: boolean;
}

export interface MonthDragState {
  id: string;
  pill: HTMLElement;
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  ghost: HTMLElement | null;
  started: boolean;
  lastCell: HTMLElement | null;
}
