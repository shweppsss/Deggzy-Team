// ============================================================================
// Assets render — composition. Phase TS-14C. PURE.
// ============================================================================

import type { AssetGridResult, AssetModel, AssetViewResult } from './types';
import { containerIdFor } from './calculations';
import { buildAssetTile, buildAddTile } from './widgets/tile';

export function buildAssetsView(model: AssetModel): AssetViewResult {
  const grids: AssetGridResult[] = model.categories.map((category) => {
    const items = Array.isArray(model.byCategory[category]) ? model.byCategory[category] : [];
    const tiles = items.map((item, i) => buildAssetTile(category, i, item)).join('');
    const html = tiles + buildAddTile(category);
    return { category, containerId: containerIdFor(category), html };
  });
  return { grids };
}
