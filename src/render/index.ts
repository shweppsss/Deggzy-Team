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
export { CALENDAR_SECTION } from './calendar';
export { INSPIRATIONS_SECTION } from './inspiration';
export { TEAM_SECTION } from './members';
