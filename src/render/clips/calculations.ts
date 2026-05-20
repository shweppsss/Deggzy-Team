// ============================================================================
// Video-section render — calculations. Phase TS-14C. PURE.
// ============================================================================

import type { VideoItem, VideoSectionKind } from './types';

export function sortByAddedAtDesc(list: VideoItem[]): VideoItem[] {
  return list.slice().sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
}

export function emptyTitle(kind: VideoSectionKind): string {
  return kind === 'clips' ? "Aucun clip pour l'instant" : "Aucune capsule pour l'instant";
}

export function emptyHint(kind: VideoSectionKind): string {
  return kind === 'clips'
    ? 'Drop tes teasers, TikTok, snippets ici.'
    : 'Drop tes interviews, BTS, lives ici.';
}
