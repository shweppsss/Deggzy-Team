// ============================================================================
// Playback recovery — restore last track + currentTime after refresh.
// Phase TS-19.
//
// Persistence is delegated to the deps' `persistRecovery` / `loadRecovery`
// callbacks (typically a localStorage key). The controller calls
// `captureSnapshot()` on every `timeupdate` (rAF-throttled by the audio
// store already) and on `pause` / `ended`. On boot, the controller can
// call `consumeSnapshot()` to read the saved state once.
//
// "Recover" means: read the snapshot, attempt resolve audio + cover URL,
// set audio.currentTime to the saved position. We DO NOT auto-play
// because iOS Safari blocks playback outside a user gesture.
// ============================================================================

import type { PlayerDeps, PlayerRecoverySnapshot } from './types';

let _deps: PlayerDeps | null = null;

export function registerRecoveryDeps(deps: PlayerDeps): void {
  _deps = deps;
}

/**
 * Capture a snapshot of the current playback state and forward to the
 * deps' persistRecovery hook. Returns the snapshot for callers that want
 * to mirror it in memory. Returns null if no track is loaded.
 */
export function captureSnapshot(
  trackId: string | null,
  currentTime: number,
  wasPlaying: boolean
): PlayerRecoverySnapshot | null {
  if (!trackId) return null;
  const snapshot: PlayerRecoverySnapshot = {
    trackId,
    currentTime: Math.max(0, currentTime || 0),
    wasPlaying,
    savedAt: Date.now(),
  };
  if (_deps && _deps.persistRecovery) {
    try { _deps.persistRecovery(snapshot); } catch { /* persistence failure must not break playback */ }
  }
  return snapshot;
}

/**
 * Read the persisted snapshot through the deps. Returns null if none.
 * Does NOT clear it — that's the controller's job (typically: clear once
 * the user starts a new manual play).
 */
export function readSnapshot(): PlayerRecoverySnapshot | null {
  if (!_deps || !_deps.loadRecovery) return null;
  try { return _deps.loadRecovery() || null; }
  catch { return null; }
}
