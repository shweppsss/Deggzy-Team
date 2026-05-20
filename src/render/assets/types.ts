// ============================================================================
// Assets render — types. Phase TS-14C.
// ============================================================================

export interface AssetItem {
  name?: string;
  type?: string;
  data?: string;
  [key: string]: unknown;
}

export type AssetCategory = 'DA' | 'Photos' | 'Tiktok' | 'BTS' | string;

export interface AssetModel {
  /** Map of category → asset items. */
  byCategory: Record<string, AssetItem[]>;
  /** Ordered list of categories rendered in the UI. */
  categories: ReadonlyArray<AssetCategory>;
}

export interface AssetGridResult {
  category: AssetCategory;
  /** Container element id (e.g. 'assetsDA'). */
  containerId: string;
  html: string;
}

export interface AssetViewResult {
  /** One result per category — mount.ts writes each into its container. */
  grids: AssetGridResult[];
}

export interface AssetDeps {
  /** No external deps — assets renderer is fully self-contained. */
}
