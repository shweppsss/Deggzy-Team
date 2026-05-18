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
//   TS-5  ← current PR: MiniPlayer → /src/features/mini-player.ts
//   TS-6+    business domains (auth, calendar, detail overlay, modals)
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
import { MiniPlayer } from './features/mini-player';

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
