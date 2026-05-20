// ============================================================================
// Track audio/cover URL resolution + in-memory blob URL lifecycle. Phase TS-18.
//
// Two layers of cache:
//   1. In-memory `_audioCache` / `_coverCache` keyed by trackId. Holds the
//      LIVE object URL — must be revoked when evicted, else we leak Blobs.
//   2. IndexedDB (via ./idb). The source of truth on-device.
// On miss, fall through to Supabase Storage and warm both caches.
//
// Prewarm dedupe: concurrent `getTrackAudioUrl(id)` calls for the same id
// share a single in-flight promise (no double-fetch, no double-IDB-read).
// ============================================================================

import type { AudioCacheDeps, CachedAudio } from './types';
import { idbGetAudio, idbSaveAudio, idbGetCover, idbSaveCover } from './idb';

let _deps: AudioCacheDeps | null = null;

/** Register the cache deps. Called once at boot. */
export function registerAudioCacheDeps(deps: AudioCacheDeps): void {
  _deps = deps;
}

// ---------------------------------------------------------------------------
// AUDIO
// ---------------------------------------------------------------------------
const _audioCache: Record<string, CachedAudio> = {};
const _audioInflight: Record<string, Promise<CachedAudio | null>> = {};

/**
 * Resolve an audio object URL for a track id.
 * Returns null when no audio is available anywhere (no IDB record + no
 * Supabase fallback + no deps registered).
 */
export function getTrackAudioUrl(trackId: string): Promise<CachedAudio | null> {
  const cached = _audioCache[trackId];
  if (cached) return Promise.resolve(cached);
  // Dedupe concurrent calls — same in-flight promise is shared.
  const inflight = _audioInflight[trackId];
  if (inflight) return inflight;
  const p = _resolveTrackAudio(trackId).finally(() => {
    delete _audioInflight[trackId];
  });
  _audioInflight[trackId] = p;
  return p;
}

async function _resolveTrackAudio(trackId: string): Promise<CachedAudio | null> {
  // 1. Try IDB
  try {
    const data = await idbGetAudio('track_' + trackId);
    if (data && data.blob) {
      const url = URL.createObjectURL(data.blob);
      const entry: CachedAudio = { url, name: data.name, type: data.type, size: data.size };
      _audioCache[trackId] = entry;
      return entry;
    }
  } catch (e) {
    console.warn('idbGetAudio failed:', e);
  }
  // 2. Fall back to Supabase Storage
  if (!_deps) return null;
  try {
    const track = _deps.getTracks().find((x) => x.id === trackId);
    if (track && track.sbAudioPath) {
      const blob = await _deps.sbDownloadBlob(_deps.audioBucket, track.sbAudioPath);
      if (blob) {
        const name = (track.audioMeta && track.audioMeta.name) || 'audio';
        try { await idbSaveAudio('track_' + trackId, new File([blob], name, { type: blob.type })); } catch { /* IDB write failure must not break playback */ }
        const url = URL.createObjectURL(blob);
        const entry: CachedAudio = { url, name, type: blob.type, size: blob.size };
        _audioCache[trackId] = entry;
        return entry;
      }
    }
  } catch (e) {
    console.warn('cloud download audio failed:', e);
  }
  return null;
}

/** Synchronous read of an already-cached audio entry (used by playTrackInMini). */
export function peekTrackAudioUrl(trackId: string): CachedAudio | null {
  return _audioCache[trackId] || null;
}

// ---------------------------------------------------------------------------
// COVER
// ---------------------------------------------------------------------------
const _coverCache: Record<string, string> = {};
const _coverInflight: Record<string, Promise<string | null>> = {};

export function getTrackCoverUrl(trackId: string): Promise<string | null> {
  const cached = _coverCache[trackId];
  if (cached) return Promise.resolve(cached);
  const inflight = _coverInflight[trackId];
  if (inflight) return inflight;
  const p = _resolveTrackCover(trackId).finally(() => {
    delete _coverInflight[trackId];
  });
  _coverInflight[trackId] = p;
  return p;
}

async function _resolveTrackCover(trackId: string): Promise<string | null> {
  try {
    const data = await idbGetCover(trackId);
    if (data && data.blob) {
      const url = URL.createObjectURL(data.blob);
      _coverCache[trackId] = url;
      return url;
    }
  } catch (e) {
    console.warn('idbGetCover failed:', e);
  }
  if (!_deps) return null;
  try {
    const track = _deps.getTracks().find((x) => x.id === trackId);
    if (track && track.sbCoverPath) {
      const blob = await _deps.sbDownloadBlob(_deps.coverBucket, track.sbCoverPath);
      if (blob) {
        try { await idbSaveCover(trackId, blob); } catch { /* IDB write failure must not break cover */ }
        const url = URL.createObjectURL(blob);
        _coverCache[trackId] = url;
        return url;
      }
    }
  } catch (e) {
    console.warn('cloud download cover failed:', e);
  }
  return null;
}

export function peekTrackCoverUrl(trackId: string): string | null {
  return _coverCache[trackId] || null;
}

// ---------------------------------------------------------------------------
// TEST HOOKS
// ---------------------------------------------------------------------------
export function _getAudioCacheRef(): Readonly<Record<string, CachedAudio>> { return _audioCache; }
export function _getCoverCacheRef(): Readonly<Record<string, string>> { return _coverCache; }
export function _getAudioInflightCount(): number { return Object.keys(_audioInflight).length; }
export function _getCoverInflightCount(): number { return Object.keys(_coverInflight).length; }

/** Test hook: clear in-memory caches + revoke URLs. Does NOT touch IDB. */
export function _resetUrlCaches(): void {
  for (const id of Object.keys(_audioCache)) {
    try { URL.revokeObjectURL(_audioCache[id].url); } catch { /* ignore */ }
    delete _audioCache[id];
  }
  for (const id of Object.keys(_coverCache)) {
    try { URL.revokeObjectURL(_coverCache[id]); } catch { /* ignore */ }
    delete _coverCache[id];
  }
  for (const k of Object.keys(_audioInflight)) delete _audioInflight[k];
  for (const k of Object.keys(_coverInflight)) delete _coverInflight[k];
}
