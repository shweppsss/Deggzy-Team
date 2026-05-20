// ============================================================================
// Inspirations render — barrel. Phase TS-14B.
// ============================================================================
export type {
  InspiEntity, NormalizedInspi, InspiFilterKey, InspiModel, InspiViewResult, InspiDeps,
  InspiMediaType,
} from './types';

export {
  applyFilter, sortByAddedAtDesc, countByCategory, normalizeInspi,
} from './calculations';

export { buildInspiFilterChips } from './widgets/filter-chips';
export { buildInspiCard } from './widgets/card';

export { buildInspirationsView } from './composition';
export {
  renderInspirationsView, registerInspirationsSideEffects, type InspirationsSideEffects,
} from './mount';
