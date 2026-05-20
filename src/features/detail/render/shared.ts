// ============================================================================
// Detail renderers — shared deps. Phase TS-8 (FINAL).
//
// This file is now 100% import-driven. Zero `window.X` accesses.
//
// Sources:
//   - `escapeHtml`, `formatDate*`, `formatEventTime`, `formatDuration`,
//     `formatEventRange`, `formatRelativeShort` → `/src/lib/format-utils`
//   - `typeLabel`, `statusLabel`, `EVENT_TYPES`, `TODO_CATEGORIES`,
//     `PRIORITY_KEYS`, `PRIORITY_LABELS`, `todoPriority`, `tagsToInput`,
//     `suggestChecklist` → `../domain`
//   - `eventActorAvatarHTML` → `../event-actor` (extracted pure helpers)
//   - `trackAudioPillHTML` → `/src/lib/legacy-bridge` (the SINGLE
//     allowed bridge point for the audio-store-dependent inline helper)
//
// The renderers themselves consume a frozen `RenderDeps` snapshot —
// they never read `window`, `document`, or `state`. Same purity contract
// as TS-7, but now with zero runtime bridge inside `/src/features/detail/`.
// ============================================================================

import {
  escapeHtml,
  formatDate,
  formatDateLong,
  formatEventTime,
  formatDuration,
  formatEventRange,
  formatRelativeShort,
} from '../../../lib/format-utils';

import {
  typeLabel,
  statusLabel,
  todoPriority,
  tagsToInput,
  suggestChecklist,
  EVENT_TYPES,
  TODO_CATEGORIES,
  PRIORITY_KEYS,
  PRIORITY_LABELS,
} from '../domain';

import { eventActorAvatarHTML } from '../event-actor';
import { trackAudioPillHTML } from '../../../lib/legacy-bridge';

/**
 * Render-time dependencies. Every member is now a real TS function or
 * imported constant — no runtime `window` lookups, no defensive fallbacks,
 * no `typeof` guards. The full type-checker enforces correctness at
 * compile time.
 */
export interface RenderDeps {
  // String helpers
  escapeHtml: typeof escapeHtml;

  // Formatters
  typeLabel: typeof typeLabel;
  statusLabel: typeof statusLabel;
  formatDate: typeof formatDate;
  formatDateLong: typeof formatDateLong;
  formatEventTime: typeof formatEventTime;
  formatDuration: typeof formatDuration;
  formatEventRange: typeof formatEventRange;
  formatRelativeShort: typeof formatRelativeShort;

  // Detail-feature helpers
  eventActorAvatarHTML: typeof eventActorAvatarHTML;
  /** Bridged from `/src/lib/legacy-bridge` until the audio store migrates. */
  trackAudioPillHTML: typeof trackAudioPillHTML;

  // Domain logic helpers
  todoPriority: typeof todoPriority;
  tagsToInput: typeof tagsToInput;
  suggestChecklist: typeof suggestChecklist;

  // Constant tables (readonly tuples / records)
  eventTypes: typeof EVENT_TYPES;
  todoCategories: typeof TODO_CATEGORIES;
  priorityKeys: typeof PRIORITY_KEYS;
  priorityLabels: typeof PRIORITY_LABELS;
}

/**
 * Build the deps object for a single render call. Returns a frozen snapshot
 * so the renderer cannot accidentally mutate the shared registry.
 */
export function getRenderDeps(): RenderDeps {
  return Object.freeze({
    escapeHtml,
    typeLabel,
    statusLabel,
    formatDate,
    formatDateLong,
    formatEventTime,
    formatDuration,
    formatEventRange,
    formatRelativeShort,
    eventActorAvatarHTML,
    trackAudioPillHTML,
    todoPriority,
    tagsToInput,
    suggestChecklist,
    eventTypes: EVENT_TYPES,
    todoCategories: TODO_CATEGORIES,
    priorityKeys: PRIORITY_KEYS,
    priorityLabels: PRIORITY_LABELS,
  });
}
