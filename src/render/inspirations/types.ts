// ============================================================================
// Inspirations render — types. Phase TS-14B.
// ============================================================================

export type InspiMediaType = 'image' | 'video' | 'embed' | 'link' | 'note' | string;

export interface InspiEntity {
  id: string;
  title?: string;
  category?: string;
  notes?: string;
  addedAt?: string;
  // v1 schema
  type?: string;
  url?: string;
  data?: string | null;
  dataType?: string;
  // v2 schema
  mediaType?: InspiMediaType;
  mediaUrl?: string;
  mediaEmbed?: string;
  provider?: string;
  aspect?: string;
  // IDB-backed media
  idbInspi?: boolean;
  idbInspiType?: string;
  [key: string]: unknown;
}

/** Normalized inspiration — `_*` fields are the render-time view. */
export interface NormalizedInspi extends InspiEntity {
  _mediaType: InspiMediaType;
  _mediaUrl: string;
  _mediaEmbed: string;
  _needsHydrate: boolean;
  _isVideoFile: boolean;
}

export type InspiFilterKey = 'all' | string;

export interface InspiModel {
  list: InspiEntity[];
  filter: InspiFilterKey;
}

export interface InspiViewResult {
  filterChipsHtml: string;
  /** Empty → mount uses emptyState; otherwise gridHtml is the inspi cards. */
  empty: boolean;
  gridHtml: string;
}

export interface InspiDeps {
  escapeHtml: (s: string | null | undefined) => string;
  icon: (name: string, size?: number, extra?: string) => string;
  emptyState: (kind: string, title: string, hint?: string, ctaLabel?: string, ctaOnclick?: string) => string;
  /** Parse a media URL into shape — comes from the legacy parseMedia helper. */
  parseMedia: (url: string) => { mediaType?: string; mediaUrl?: string; mediaEmbed?: string; provider?: string } | null;
  /** Readonly tuple of INSPI_CATEGORIES. */
  categories: ReadonlyArray<string>;
}
