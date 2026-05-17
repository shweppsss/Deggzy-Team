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
//   TS-2  ← current PR: App.Boot → /src/core/boot.ts
//   TS-3     App.Instrumentation → /src/core/instrumentation.ts
//   TS-5+    feature modules (auth, onboarding, calendar, detail, modals)
//   TS-final HTML decomposition
// ============================================================================

import { Runtime } from './core/runtime';
import { Boot } from './core/boot';

// Augment the global Window type so the legacy code that references
// `window.App.Runtime.*` / `window.App.Boot.*` compiles against the
// same surface as the runtime version exposes.
declare global {
  interface Window {
    App: {
      Runtime?: typeof Runtime;
      Boot?: typeof Boot;
      [key: string]: unknown;
    };
  }
}

// Set up the global App namespace (idempotent — defensive against any
// inline code that might have already touched it).
window.App = window.App || {};

// Expose the typed core modules on window. This must happen BEFORE any
// code that uses `window.App.X.*` runs at user-interaction time. Module
// scripts are deferred by the HTML spec, so these assignments land
// before DOMContentLoaded fires — which means before any user
// interaction can trigger a binder. All binders that read these
// surfaces use a defensive `typeof window.App.X` check anyway, so the
// order would be safe even if it slipped.
window.App.Runtime = Runtime;
window.App.Boot = Boot;
