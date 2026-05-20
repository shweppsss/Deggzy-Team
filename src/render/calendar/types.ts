// ============================================================================
// Calendar render — types. Phase TS-13C.
//
// Strict typing for the event shapes the calendar renderer consumes. Kept
// MINIMAL — only fields the renderers actually read. The full event row
// in state.events carries more (tags, attribution, etc.); those flow
// through as `unknown` extra keys.
// ============================================================================

/** A user actor (creator / updater). */
export interface CalendarActor {
  id?: string;
  name?: string;
}

/** A calendar event (renderable shape — read-only at render time). */
export interface CalendarEvent {
  id: string;
  title?: string;
  type?: string;
  date?: string;       // YYYY-MM-DD
  endDate?: string;
  time?: string;       // HH:MM
  duration?: number | string;
  visibility?: string; // 'team' | 'private'
  tags?: unknown;
  createdBy?: CalendarActor;
  updatedBy?: CalendarActor;
  createdAt?: string;
  updatedAt?: string;
  recurrence?: { freq?: string; until?: string } | null;
  notes?: string;
  // Render-time virtual flags (set by expansion helpers — see calculations.ts).
  _isVirtual?: boolean;
  _isRecurring?: boolean;
  _spanIndex?: number;
  _spanTotal?: number;
  [key: string]: unknown;
}

/** Conflicts map keyed by event id. */
export type ConflictsMap = Map<string, CalendarEvent[]>;

/**
 * Calendar deps — the small set of LEGACY helpers the calendar render
 * still needs from the host. Same pattern as detail's RenderDeps but
 * narrower. main.ts builds this snapshot once per render.
 */
export interface CalendarDeps {
  /** Format a single event's tooltip (creator / editor lines). */
  eventTooltip: (e: CalendarEvent) => string;
  /** Tag chips HTML — small renderer that takes a tags array. */
  tagChipsHTML: (tags: unknown, opts?: { limit?: number }) => string;
  /** Per-event tag-filter predicate — returns true if the active filter matches. */
  entityMatchesTagFilter: (e: CalendarEvent) => boolean;
  /** Visibility filter — drops private events that don't belong to the viewer. */
  filterVisibleEvents: (events: CalendarEvent[]) => CalendarEvent[];
  /** HTML for the small circular actor avatar — calendar uses size-default. */
  eventActorAvatarHTML: (actor: CalendarActor | undefined | null) => string;
}
