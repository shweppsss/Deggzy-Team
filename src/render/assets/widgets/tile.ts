// ============================================================================
// Assets widget — single tile + add-tile. Phase TS-14C. PURE HTML.
// ============================================================================

import type { AssetItem, AssetCategory } from '../types';
import { isVideoAsset } from '../calculations';

/** A single asset tile — video or image. */
export function buildAssetTile(category: AssetCategory, index: number, item: AssetItem): string {
  if (isVideoAsset(item)) {
    return `
      <div class="asset-tile">
        <video src="${item.data}" controls></video>
        <button class="del" onclick="deleteAsset('${category}', ${index})" aria-label="Supprimer l'asset" type="button">×</button>
      </div>
    `;
  }
  return `
    <div class="asset-tile" style="background-image: url('${item.data}')">
      <button class="del" onclick="deleteAsset('${category}', ${index})">×</button>
    </div>
  `;
}

/** The "+ Ajouter" tile at the end of each grid. */
export function buildAddTile(category: AssetCategory): string {
  return `
    <label class="asset-tile asset-tile-add">
      + Ajouter
      <input type="file" accept="image/*,video/*" multiple onchange="handleAssetUpload('${category}', event)" />
    </label>
  `;
}
