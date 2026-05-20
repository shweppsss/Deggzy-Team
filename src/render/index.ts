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

// TS-14A — dashboard moves to its own sub-module. Section id inline here.
export const DASHBOARD_SECTION = 'dashboard' as const;
// TS-14B — todos + inspirations migrated to sub-modules with their own render.
export const TODOS_SECTION = 'todos' as const;
// TS-13C — calendar is now a sub-module with its own render code. The
// SECTION_ID constant is co-located inside ./calendar/index.ts.
export const CALENDAR_SECTION = 'calendar' as const;
export const INSPIRATIONS_SECTION = 'inspirations' as const;
export { TEAM_SECTION } from './members';
