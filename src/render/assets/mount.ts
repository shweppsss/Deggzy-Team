// ============================================================================
// Assets render — DOM mounting. Phase TS-14C.
// ============================================================================

import { getState } from '../../data';
import type { AssetItem, AssetModel } from './types';
import { ASSET_CATEGORIES } from './calculations';
import { buildAssetsView } from './composition';
import { viewTransition } from '../../features/mobile/transitions';

interface StateSlice {
  assets?: Record<string, AssetItem[]>;
}

export function renderAssetsView(): void {
  const state = getState() as StateSlice;
  const model: AssetModel = {
    byCategory: state.assets || {},
    categories: ASSET_CATEGORIES,
  };
  const result = buildAssetsView(model);
  for (const grid of result.grids) {
    const container = document.getElementById(grid.containerId);
    if (container) viewTransition(() => { container.innerHTML = grid.html; });
  }
}
