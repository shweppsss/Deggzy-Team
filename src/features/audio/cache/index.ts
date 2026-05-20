// ============================================================================
// Audio cache — barrel. Phase TS-18.
//
// Single `registerAudioCache(deps)` entry point wires every sub-module to
// the same deps. The IDB primitives are stateless and need no registration.
// ============================================================================

import type { AudioCacheDeps } from './types';
import { registerAudioCacheDeps } from './urls';
import { registerPrewarmDeps } from './prewarm';
import { registerHydrateDeps } from './hydrate';

export type { AudioCacheDeps, CachedAudio, CachedTrack } from './types';
export type { IdbAudioRecord, IdbCoverRecord } from './idb';
export {
  IDB_NAME,
  IDB_STORE,
  openIDB,
  idbSaveAudio,
  idbGetAudio,
  idbDeleteAudio,
  idbSaveCover,
  idbGetCover,
  idbDeleteCover,
  _resetIdbPromise,
  _getIdbPromise,
} from './idb';
export {
  getTrackAudioUrl,
  peekTrackAudioUrl,
  getTrackCoverUrl,
  peekTrackCoverUrl,
  _getAudioCacheRef,
  _getCoverCacheRef,
  _getAudioInflightCount,
  _getCoverInflightCount,
  _resetUrlCaches,
} from './urls';
export { clearAudioCache, clearCoverCache, clearTrackCache } from './cleanup';
export { prewarmAudioCache } from './prewarm';
export { hydrateAllAudios, hydrateAllCovers } from './hydrate';

/** Wire all cache sub-modules to the same deps. Call once at boot. */
export function registerAudioCache(deps: AudioCacheDeps): void {
  registerAudioCacheDeps(deps);
  registerPrewarmDeps(deps);
  registerHydrateDeps(deps);
}
