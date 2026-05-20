// ============================================================================
// Cache eviction — revoke blob URLs + drop in-memory entries. Phase TS-18.
//
// The IDB record is NOT deleted here; that's done by the higher-level
// deleteTrack flow (inline today). These functions just stop hanging on
// to the live object URL.
// ============================================================================

import { _getAudioCacheRef, _getCoverCacheRef } from './urls';

/** Drop the in-memory audio entry for a track + revoke its object URL. */
export function clearAudioCache(trackId: string): void {
  const cache = _getAudioCacheRef() as Record<string, { url: string }>;
  const entry = cache[trackId];
  if (entry) {
    try { URL.revokeObjectURL(entry.url); } catch { /* ignore */ }
    delete cache[trackId];
  }
}

/** Drop the in-memory cover entry for a track + revoke its object URL. */
export function clearCoverCache(trackId: string): void {
  const cache = _getCoverCacheRef() as Record<string, string>;
  const url = cache[trackId];
  if (url) {
    try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    delete cache[trackId];
  }
}

/** Convenience: clear both audio and cover for a track. */
export function clearTrackCache(trackId: string): void {
  clearAudioCache(trackId);
  clearCoverCache(trackId);
}
