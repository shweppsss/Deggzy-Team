// ============================================================================
// Inspirations render — calculations. Phase TS-14B.
// PURE: normalize / filter / sort. NO DOM, NO state read.
// ============================================================================

import type { InspiDeps, InspiEntity, InspiFilterKey, NormalizedInspi } from './types';

/** Apply the category filter. Returns a new array. */
export function applyFilter(list: InspiEntity[], filter: InspiFilterKey): InspiEntity[] {
  if (filter === 'all') return list.slice();
  return list.filter((i) => i.category === filter);
}

/** Sort by addedAt descending (newest first). Stable, deterministic. */
export function sortByAddedAtDesc(list: InspiEntity[]): InspiEntity[] {
  return list.slice().sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
}

/** Per-filter count for the chips. */
export function countByCategory(list: InspiEntity[], category: InspiFilterKey): number {
  if (category === 'all') return list.length;
  return list.filter((i) => i.category === category).length;
}

/**
 * Resolve legacy v1 + v2 + IDB shapes into a single `NormalizedInspi`.
 * PURE — no DOM. Calls deps.parseMedia for legacy `type:'link'` URLs.
 */
export function normalizeInspi(it: InspiEntity, deps: InspiDeps): NormalizedInspi {
  let mediaType: InspiEntity['mediaType'] = it.mediaType;
  let mediaUrl = it.mediaUrl || '';
  let mediaEmbed = it.mediaEmbed || '';
  let isVideoFile = false;

  if (!mediaType) {
    // Migration from the legacy schema.
    if (it.type === 'image' && it.data) {
      const isVideo = !!(it.dataType && it.dataType.startsWith('video'));
      isVideoFile = isVideo;
      mediaType = isVideo ? 'video' : 'image';
      mediaUrl = it.data;
    } else if (it.type === 'link' && it.url) {
      const parsed = deps.parseMedia(it.url);
      mediaType = parsed?.mediaType || 'link';
      mediaUrl = it.url;
      mediaEmbed = parsed?.mediaEmbed || '';
    } else {
      mediaType = 'note';
    }
  } else if (mediaType === 'image' && mediaUrl && mediaUrl.startsWith('data:video')) {
    mediaType = 'video';
    isVideoFile = true;
  }

  // IDB-backed media: read MIME from the recorded type so the card knows
  // to render as image vs video without needing the heavy data URL.
  const needsHydrate = !!it.idbInspi;
  if (needsHydrate && !it.mediaType) {
    const mime = it.idbInspiType || it.dataType || '';
    mediaType = mime.startsWith('video') ? 'video' : 'image';
    mediaUrl = '';
  }

  return {
    ...it,
    _mediaType: mediaType || 'note',
    _mediaUrl: mediaUrl,
    _mediaEmbed: mediaEmbed,
    _needsHydrate: needsHydrate,
    _isVideoFile: isVideoFile,
  };
}
