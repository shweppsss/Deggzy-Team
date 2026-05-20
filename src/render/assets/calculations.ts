// ============================================================================
// Assets render — calculations. Phase TS-14C.
// PURE: maps a category name to its container id. Detect video vs image.
// ============================================================================

import type { AssetItem, AssetCategory } from './types';

export const ASSET_CATEGORIES: ReadonlyArray<AssetCategory> = ['DA', 'Photos', 'Tiktok', 'BTS'];

/** Container element id from a category name (matches the inline DOM ids). */
export function containerIdFor(category: AssetCategory): string {
  return 'assets' + category;
}

export function isVideoAsset(item: AssetItem): boolean {
  return !!(item.type && item.type.startsWith('video'));
}
