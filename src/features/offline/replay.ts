// ============================================================================
// Replay-on-reconnect. Phase Offline-1.
//
// Wires the connectivity tracker to the queue: when the status flips from
// offline → online AND the queue is dirty, fire one cloud push. The push
// itself is the deps' triggerCloudPush — typically delegated to the
// existing save pipeline's cloud sync hook.
//
// Race protection: a monotonic token guards against overlapping replays
// (rapid online/offline flapping or manual triggerReplay() calls). Older
// pushes that resolve after a newer one are observed but their
// markCloudSynced is skipped.
// ============================================================================

import type { OfflineDeps } from './types';
import { subscribeConnectivity } from './connectivity';
import { isDirty, markCloudSynced, markCloudFailure, getOfflineSnapshot } from './queue';

let _deps: OfflineDeps | null = null;
let _token = 0;
let _lastStatus: 'online' | 'offline' = 'online';

export function registerReplayDeps(deps: OfflineDeps): void {
  _deps = deps;
  // Subscribe to connectivity transitions.
  subscribeConnectivity((s) => {
    const prev = _lastStatus;
    _lastStatus = s;
    if (s === 'online' && prev === 'offline' && isDirty()) {
      void triggerReplay();
    }
  });
}

/**
 * Manually trigger a cloud-push attempt. Returns true if the push
 * completed (or there was nothing to push). Returns false on failure.
 *
 * Idempotent under concurrency: a fresh token is minted on every call
 * and only the latest one writes back to the queue's cloudVersion.
 */
export async function triggerReplay(): Promise<boolean> {
  if (!_deps) return false;
  if (!isDirty()) return true;
  const token = ++_token;
  const snap = getOfflineSnapshot();
  const localAtStart = snap.localVersion;
  try {
    const result = _deps.triggerCloudPush();
    if (result && typeof (result as Promise<void>).then === 'function') {
      await result;
    }
    if (token !== _token) return true; // superseded; newer replay wins
    markCloudSynced(localAtStart);
    if (_deps.toast) {
      try { _deps.toast('Synchronisé ✓'); } catch { /* ignore */ }
    }
    return true;
  } catch (e) {
    console.warn('[offline] replay failed:', e);
    if (token === _token) markCloudFailure();
    return false;
  }
}

// Test hooks ----------------------------------------------------------------
export function _getReplayToken(): number { return _token; }
export function _resetReplay(): void { _token = 0; _lastStatus = 'online'; _deps = null; }
