// ============================================================================
// Render — dashboard section. Phase TS-12 (skeleton).
//
// The actual `renderDashboard()` body is still inline in index.html
// (large, depends on many inline helpers — extraction is TS-13+). For
// TS-12 we just publish the SECTION_ID constant so the dispatch registry
// has a typed handle for the registration in main.ts.
//
// Future:
//   - move the inline `renderDashboard` body here as `renderDashboard()`
//   - drop the legacy `window.renderDashboard` shim
// ============================================================================

import type { SectionId } from './types';

export const DASHBOARD_SECTION: SectionId = 'dashboard';
