// ============================================================================
// Catalogue render — composition. Phase TS-15. PURE.
// ============================================================================

import type { CatalogueDeps, CatalogueModel, CatalogueViewResult } from './types';
import { buildTrackCard } from './widgets/track-card';

export function buildCatalogueView(model: CatalogueModel, deps: CatalogueDeps): CatalogueViewResult {
  const tracks = Array.isArray(model.tracks) ? model.tracks : [];
  if (tracks.length === 0) return { gridHtml: '', empty: true };
  return { gridHtml: tracks.map((t) => buildTrackCard(t, deps)).join(''), empty: false };
}
