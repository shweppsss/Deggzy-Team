// ============================================================================
// Catalogue render — types. Phase TS-15.
// ============================================================================

export interface CatalogueTrack {
  id: string;
  name?: string;
  status?: string;
  releaseDate?: string;
  duration?: string;
  bpm?: string;
  feat?: string;
  cover?: string | null;
  idbCover?: unknown;
  [key: string]: unknown;
}

export interface CatalogueModel {
  tracks: CatalogueTrack[];
}

export interface CatalogueViewResult {
  gridHtml: string;
  empty: boolean;
}

export interface CatalogueDeps {
  escapeHtml: (s: string | null | undefined) => string;
  formatDate: (s: string | undefined) => string;
  statusLabel: (s: string | undefined) => string;
  /** Audio-slot HTML — still owned by inline `trackAudioInitialHTML` until TS-17. */
  trackAudioInitialHTML: (t: CatalogueTrack) => string;
}
