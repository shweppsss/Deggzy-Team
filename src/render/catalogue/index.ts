// ============================================================================
// Catalogue render — barrel. Phase TS-15.
// ============================================================================
export type { CatalogueTrack, CatalogueModel, CatalogueViewResult, CatalogueDeps } from './types';
export { buildTrackCard } from './widgets/track-card';
export { buildCatalogueView } from './composition';
export {
  renderCatalogueView, registerCatalogueSideEffects, type CatalogueSideEffects,
} from './mount';
