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
//   TS-1  ← current PR: App.Runtime extracted to /src/core/runtime.ts
//   TS-2     App.Boot → /src/core/boot.ts
//   TS-3     App.Instrumentation → /src/core/instrumentation.ts
//   TS-5+    feature modules (auth, onboarding, calendar, detail, modals)
//   TS-final HTML decomposition
// ============================================================================

import { Runtime } from './core/runtime';

// Augment the global Window type so the legacy code that references
// `window.App.Runtime.*` compiles against the same surface as the
// runtime version exposes.
declare global {
  interface Window {
    App: {
      Runtime?: typeof Runtime;
      [key: string]: unknown;
    };
  }
}

// Set up the global App namespace (idempotent — defensive against any
// inline code that might have already touched it).
window.App = window.App || {};

// Expose the typed Runtime on window. This must happen BEFORE any code
// that uses `window.App.Runtime.*` runs at user-interaction time.
// Module scripts are deferred by the HTML spec, so this assignment
// lands before DOMContentLoaded fires — which means before any user
// interaction can trigger a binder. All binders that read Runtime use
// a defensive `typeof window.App.Runtime` check anyway, so the order
// would be safe even if it slipped.
window.App.Runtime = Runtime;
