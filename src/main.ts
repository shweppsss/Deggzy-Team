// ============================================================================
// Deggzy-Team — TypeScript migration entry point
// ============================================================================
//
// This module is the single Vite entry point. It imports the typed core
// modules and re-exposes them on `window.App.X` so that the remaining
// inline code in index.html (and inline event handlers) keep seeing the
// same global names during the transition.
//
// Migration roadmap:
//   TS-0  ✓  tooling setup (empty entry point)
//   TS-1  ✓  App.Runtime → /src/core/runtime.ts
//   TS-2  ✓  App.Boot → /src/core/boot.ts
//   TS-3  ✓  App.Instrumentation → /src/core/instrumentation.ts
//   TS-4  ✓  render utilities → /src/lib/render-utils.ts
//   TS-5  ✓  MiniPlayer → /src/features/mini-player.ts
//   TS-6  ✓  detail overlay lifecycle → /src/features/detail/
//   TS-7  ✓  detail render helpers (per-kind, pure) → /src/features/detail/render/
//   TS-8  ← current PR: kill detail bridge → /src/lib/format-utils.ts + /src/features/detail/domain.ts
//   TS-9+    modals, auth, calendar
//   TS-final HTML decomposition
// ============================================================================

import { Runtime } from './core/runtime';
import { Boot } from './core/boot';
import { Instrumentation } from './core/instrumentation';
import {
  ICONS,
  icon,
  hydrateIcons,
  EMPTY_ART,
  emptyState,
  parseDate,
  isFutureOrToday,
} from './lib/render-utils';
import {
  escapeHtml,
  formatDate,
  formatDateLong,
  formatEventTime,
  formatDuration,
  formatEventRange,
  formatRelativeShort,
  timeToMins,
  minsToTime,
} from './lib/format-utils';
import { MiniPlayer } from './features/mini-player';
import { openDetail, closeDetail, bindDetailClose } from './features/detail';
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
} from './features/detail/domain';
import {
  actorInitial,
  actorColor,
  eventActorAvatarHTML,
} from './features/detail/event-actor';

// Augment the global Window type so the legacy code that references
// `window.App.X.*` and the bare-global helpers (icon, parseDate, etc.)
// compiles against the same surface as the runtime version exposes.
declare global {
  interface Window {
    App: {
      Runtime?: typeof Runtime;
      Boot?: typeof Boot;
      Instrumentation?: typeof Instrumentation;
      [key: string]: unknown;
    };
    // Bare globals — historically declared via `const X = ...` at module
    // scope inside the inline <script>. The legacy call sites reference
    // them without any namespace, so we must re-attach them on `window`
    // to keep those call sites working unchanged.
    ICONS: typeof ICONS;
    icon: typeof icon;
    hydrateIcons: typeof hydrateIcons;
    EMPTY_ART: typeof EMPTY_ART;
    emptyState: typeof emptyState;
    parseDate: typeof parseDate;
    isFutureOrToday: typeof isFutureOrToday;
    MiniPlayer: typeof MiniPlayer;
    openDetail: typeof openDetail;
    closeDetail: typeof closeDetail;
    bindDetailClose: typeof bindDetailClose;
    // TS-8 — format utilities
    escapeHtml: typeof escapeHtml;
    formatDate: typeof formatDate;
    formatDateLong: typeof formatDateLong;
    formatEventTime: typeof formatEventTime;
    _formatDuration: typeof formatDuration;
    _formatEventRange: typeof formatEventRange;
    _formatRelativeShort: typeof formatRelativeShort;
    _timeToMins: typeof timeToMins;
    _minsToTime: typeof minsToTime;
    // TS-8 — detail domain
    typeLabel: typeof typeLabel;
    statusLabel: typeof statusLabel;
    todoPriority: typeof todoPriority;
    tagsToInput: typeof tagsToInput;
    suggestChecklist: typeof suggestChecklist;
    EVENT_TYPES: typeof EVENT_TYPES;
    TODO_CATEGORIES: typeof TODO_CATEGORIES;
    PRIORITY_KEYS: typeof PRIORITY_KEYS;
    PRIORITY_LABELS: typeof PRIORITY_LABELS;
    // TS-8 — detail event-actor helpers
    _actorInitial: typeof actorInitial;
    _actorColor: typeof actorColor;
    _eventActorAvatarHTML: typeof eventActorAvatarHTML;
  }
}

// Set up the global App namespace (idempotent — defensive against any
// inline code that might have already touched it).
window.App = window.App || {};

// Expose the typed core modules on window.App. This must happen BEFORE
// any code that uses `window.App.X.*` runs at user-interaction time.
// Module scripts are deferred by the HTML spec, so these assignments
// land before DOMContentLoaded fires.
window.App.Runtime = Runtime;
window.App.Boot = Boot;
window.App.Instrumentation = Instrumentation;

// Expose the bare-global render helpers. The legacy inline render
// functions in index.html call these without any namespace prefix
// (e.g. `icon('check', 14)`), so we re-attach them on `window` so
// the inline call sites keep working unchanged. This namespace
// pollution is acceptable as a migration step — future PRs that move
// the render functions themselves to TS modules will import from
// `./lib/render-utils` directly and we can drop these assignments.
window.ICONS = ICONS;
window.icon = icon;
window.hydrateIcons = hydrateIcons;
window.EMPTY_ART = EMPTY_ART;
window.emptyState = emptyState;
window.parseDate = parseDate;
window.isFutureOrToday = isFutureOrToday;

// MiniPlayer was historically `const MiniPlayer = (() => {...})()` at
// module scope inside the inline <script>, so it lives on `window` as a
// bare global. Inline call sites (`MiniPlayer.show(...)`) keep working
// unchanged after this assignment.
window.MiniPlayer = MiniPlayer;

// Detail overlay lifecycle — historically inline `function openDetail()`,
// `function closeDetail()`, `function bindDetailClose()` declared at
// module scope. Re-attached on `window` to keep the legacy inline call
// sites (`if (typeof openDetail === 'function') openDetail(kind, id);`)
// working unchanged. Future TS modules should import from
// `./features/detail` directly instead of going through window.
window.openDetail = openDetail;
window.closeDetail = closeDetail;
window.bindDetailClose = bindDetailClose;

// TS-8 — format utilities + detail domain constants/helpers. These were
// originally declared with `function X()` / `const X = ...` at module
// scope inside the inline <script>, so they live on `window` as bare
// globals. The legacy inline call sites use them without any namespace
// prefix (e.g. `escapeHtml(s)`, `EVENT_TYPES.map(...)`). The underscore-
// prefixed names match the original inline names exactly so legacy
// callers don't have to be touched.
window.escapeHtml = escapeHtml;
window.formatDate = formatDate;
window.formatDateLong = formatDateLong;
window.formatEventTime = formatEventTime;
window._formatDuration = formatDuration;
window._formatEventRange = formatEventRange;
window._formatRelativeShort = formatRelativeShort;
window._timeToMins = timeToMins;
window._minsToTime = minsToTime;
window.typeLabel = typeLabel;
window.statusLabel = statusLabel;
window.todoPriority = todoPriority;
window.tagsToInput = tagsToInput;
window.suggestChecklist = suggestChecklist;
window.EVENT_TYPES = EVENT_TYPES;
window.TODO_CATEGORIES = TODO_CATEGORIES;
window.PRIORITY_KEYS = PRIORITY_KEYS;
window.PRIORITY_LABELS = PRIORITY_LABELS;
// Event-actor helpers — historically inline `function _actorInitial()` /
// `function _actorColor()` / `function _eventActorAvatarHTML()` at module
// scope. Re-attached on window with their original underscore-prefixed
// names so the inline call sites in calendar/event rendering keep working.
window._actorInitial = actorInitial;
window._actorColor = actorColor;
window._eventActorAvatarHTML = eventActorAvatarHTML;
