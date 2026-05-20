// ============================================================================
// Render dispatch — barrel. Phase TS-12.
// ============================================================================

export type { SectionId, RouteName, RenderFn, RenderOpts } from './types';

export {
  registerSectionRenderer,
  getRegisteredSections,
  renderRoute,
  registerPostRouteHook,
  renderAll,
  registerRenderFailureHook,
  invalidateSection,
  scheduleRender,
  STATE_DEPS,
  getDirtySectionsForStateKeys,
  // Test hooks
  _resetSectionRegistry,
  _getRenderPassCount,
  _resetRenderPassCount,
  _flushRenderQueue,
} from './dispatch';

export { DASHBOARD_SECTION } from './dashboard';
export { TODOS_SECTION } from './todos';
// TS-13C — calendar is now a sub-module with its own render code. The
// SECTION_ID constant is co-located inside ./calendar/index.ts.
export const CALENDAR_SECTION = 'calendar' as const;
export { INSPIRATIONS_SECTION } from './inspiration';
export { TEAM_SECTION } from './members';
