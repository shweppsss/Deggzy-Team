// ============================================================================
// Detail renderers — shared deps interface. Phase TS-7.
//
// Each renderer in this folder follows the strict signature:
//   (entity, deps) => string
//
// `deps` is a DELIBERATE, TEMPORARY bridge to legacy inline helpers that
// have not yet been migrated to TS. Once those helpers are themselves
// extracted (TS-8+), the bridge shrinks and eventually disappears.
//
// HARD RULE (per migration directive):
//   - Renderers DO NOT read window/document/state/save() etc.
//   - Renderers DO NOT touch the DOM, audio, hydration, event binding.
//   - Renderers are deterministic: same (entity, deps) → same string.
//
// `getRenderDeps()` reads the current legacy helpers off `window` and
// returns a frozen snapshot. lifecycle.ts calls this ONCE per openDetail
// and passes the result to the appropriate `renderXxx()` function.
// ============================================================================

/**
 * The minimal surface every renderer needs. Each helper is REQUIRED at the
 * type level so that a caller who forgets one gets a compile error rather
 * than a runtime undefined-call. At runtime, getRenderDeps() falls back to
 * safe stub implementations if a window helper isn't yet defined — this
 * keeps the deferred-load window (between module eval and inline-script
 * helper definition) from crashing the very first openDetail call.
 */
export interface RenderDeps {
  // String helpers
  escapeHtml: (s: string | null | undefined) => string;

  // Formatters
  typeLabel: (t: string | undefined) => string;
  statusLabel: (s: string | undefined) => string;
  formatDate: (d: string | undefined) => string;
  formatDateLong: (d: string | undefined) => string;
  formatEventTime: (t: string | undefined) => string;
  formatDuration: (m: number) => string;
  formatEventRange: (time: string | undefined, dur: number) => string;
  formatRelativeShort: (ts: number | string | undefined) => string;

  // Sub-renderers (still legacy inline)
  eventActorAvatarHTML: (actor: unknown, cls: string) => string;
  trackAudioPillHTML: (t: unknown) => string;

  // Domain logic helpers (still legacy inline)
  todoPriority: (t: unknown) => string;
  tagsToInput: (tags: unknown) => string;
  suggestChecklist: (type: string | undefined) => string[];

  // Constant tables (still legacy inline)
  eventTypes: string[];
  todoCategories: string[];
  priorityKeys: string[];
  priorityLabels: Record<string, string>;
}

// Type alias for what we read off window — every field is optional because
// these globals come from the legacy inline <script> and may be unset.
type LegacyWindow = Window & {
  escapeHtml?: RenderDeps['escapeHtml'];
  typeLabel?: RenderDeps['typeLabel'];
  statusLabel?: RenderDeps['statusLabel'];
  formatDate?: RenderDeps['formatDate'];
  formatDateLong?: RenderDeps['formatDateLong'];
  formatEventTime?: RenderDeps['formatEventTime'];
  _formatDuration?: RenderDeps['formatDuration'];
  _formatEventRange?: RenderDeps['formatEventRange'];
  _formatRelativeShort?: RenderDeps['formatRelativeShort'];
  _eventActorAvatarHTML?: RenderDeps['eventActorAvatarHTML'];
  _trackAudioPillHTML?: RenderDeps['trackAudioPillHTML'];
  todoPriority?: RenderDeps['todoPriority'];
  tagsToInput?: RenderDeps['tagsToInput'];
  suggestChecklist?: RenderDeps['suggestChecklist'];
  EVENT_TYPES?: string[];
  TODO_CATEGORIES?: string[];
  PRIORITY_KEYS?: string[];
  PRIORITY_LABELS?: Record<string, string>;
};

// Safe no-op fallbacks so a missing window helper never crashes the
// renderer. They produce inert but VALID output: empty strings for
// formatters, the input itself for escapeHtml, empty arrays for tables.
const noopString = (): string => '';
const passthrough = (s: string | null | undefined): string => (s == null ? '' : String(s));
const noopChecklist = (): string[] => [];

/**
 * Read the current legacy helpers off window and return a frozen RenderDeps
 * snapshot. Called by lifecycle.ts at the start of every openDetail. Any
 * missing helper degrades to a safe stub — the renderer keeps producing
 * a valid string, just without that piece of formatting.
 */
export function getRenderDeps(): RenderDeps {
  const w = window as LegacyWindow;
  return Object.freeze({
    escapeHtml: w.escapeHtml || passthrough,
    typeLabel: w.typeLabel || passthrough,
    statusLabel: w.statusLabel || passthrough,
    formatDate: w.formatDate || passthrough,
    formatDateLong: w.formatDateLong || passthrough,
    formatEventTime: w.formatEventTime || passthrough,
    formatDuration: w._formatDuration || ((m: number) => String(m) + ' min'),
    formatEventRange: w._formatEventRange || noopString,
    formatRelativeShort: w._formatRelativeShort || noopString,
    eventActorAvatarHTML: w._eventActorAvatarHTML || noopString,
    trackAudioPillHTML: w._trackAudioPillHTML || noopString,
    todoPriority: w.todoPriority || (() => 'normal'),
    tagsToInput: w.tagsToInput || noopString,
    suggestChecklist: w.suggestChecklist || noopChecklist,
    eventTypes: Array.isArray(w.EVENT_TYPES) ? w.EVENT_TYPES : [],
    todoCategories: Array.isArray(w.TODO_CATEGORIES) ? w.TODO_CATEGORIES : [],
    priorityKeys: Array.isArray(w.PRIORITY_KEYS) ? w.PRIORITY_KEYS : ['critique', 'urgent', 'important', 'normal'],
    priorityLabels: w.PRIORITY_LABELS && typeof w.PRIORITY_LABELS === 'object'
      ? w.PRIORITY_LABELS
      : { critique: 'Critique', urgent: 'Urgent', important: 'Important', normal: 'Normal' },
  });
}
