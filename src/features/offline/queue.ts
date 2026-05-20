// ============================================================================
// Offline mutation queue. Phase Offline-1.
//
// We don't queue individual mutations. The save pipeline already coalesces
// them. What we track is: "the local state is dirty vs cloud, and we owe
// a cloud push as soon as we're online again."
//
// Two counters drive the model:
//   - localVersion: bumped on every save() call from the host
//   - cloudVersion: bumped on every successful cloud push
//
// dirty := localVersion > cloudVersion.
//
// The snapshot is persisted via deps.persistSnapshot so a refresh while
// offline doesn't lose the dirty flag. On reconnect, the replay module
// triggers one cloud push; on success, cloudVersion catches up and dirty
// flips false.
// ============================================================================

import type { OfflineDeps, OfflineSnapshot } from './types';

let _deps: OfflineDeps | null = null;
let _snap: OfflineSnapshot = {
  localVersion: 0,
  cloudVersion: 0,
  lastCloudSyncAt: null,
  dirty: false,
};

export function registerQueueDeps(deps: OfflineDeps): void {
  _deps = deps;
  const persisted = deps.loadSnapshot ? deps.loadSnapshot() : null;
  if (persisted) {
    _snap = { ...persisted };
    // Re-derive dirty from versions; defensive against persisted-state drift.
    _snap.dirty = _snap.localVersion > _snap.cloudVersion;
  }
}

/** Read the live snapshot. */
export function getOfflineSnapshot(): Readonly<OfflineSnapshot> {
  return _snap;
}

/** True iff we owe the cloud a push. */
export function isDirty(): boolean {
  return _snap.dirty;
}

/** Called by the host on every local save. Bumps localVersion + marks dirty. */
export function markLocalChange(): void {
  _snap = {
    ..._snap,
    localVersion: _snap.localVersion + 1,
    dirty: true,
  };
  _persist();
}

/** Called by the host after a successful cloud push. Catches cloudVersion
 *  up to localVersion at the moment the push completed; dirty flips false
 *  ONLY if no new local change happened in the meantime. */
export function markCloudSynced(syncedLocalVersion?: number): void {
  const v = syncedLocalVersion !== undefined ? syncedLocalVersion : _snap.localVersion;
  _snap = {
    ..._snap,
    cloudVersion: v,
    lastCloudSyncAt: new Date().toISOString(),
    dirty: _snap.localVersion > v,
  };
  _persist();
}

/** Called by the host on a cloud push failure. Doesn't touch versions —
 *  dirty stays true and the queue replays on the next reconnect. */
export function markCloudFailure(): void {
  // Re-persist to capture any localVersion bump that happened during the push.
  _persist();
}

function _persist(): void {
  if (!_deps) return;
  try { _deps.persistSnapshot(_snap); } catch { /* persistence failure is not fatal */ }
}

// Test hooks ----------------------------------------------------------------
export function _resetQueue(): void {
  _snap = { localVersion: 0, cloudVersion: 0, lastCloudSyncAt: null, dirty: false };
  _deps = null;
}
export function _seedQueue(snap: OfflineSnapshot): void {
  _snap = { ...snap };
}
