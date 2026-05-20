// ============================================================================
// Assets render — barrel. Phase TS-14C.
// ============================================================================
export type { AssetItem, AssetCategory, AssetModel, AssetGridResult, AssetViewResult, AssetDeps } from './types';
export { ASSET_CATEGORIES, containerIdFor, isVideoAsset } from './calculations';
export { buildAssetTile, buildAddTile } from './widgets/tile';
export { buildAssetsView } from './composition';
export { renderAssetsView } from './mount';
