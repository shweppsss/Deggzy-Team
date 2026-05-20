// ============================================================================
// Offline-first — barrel. Phase Offline-1.
//
// Single `registerOffline(deps)` entry wires every sub-module to the same
// deps. The host calls `markLocalChange()` on every save() and
// `markCloudSynced()` on successful cloud push; the replay module handles
// the reconnect-triggered retry automatically.
// ============================================================================

import type { OfflineDeps } from './types';
import { registerConnectivityDeps } from './connectivity';
import { registerQueueDeps } from './queue';
import { registerReplayDeps } from './replay';

export type { ConnectivityStatus, OfflineSnapshot, OfflineDeps } from './types';
export {
  getConnectivity, isOnline, subscribeConnectivity,
  _forceStatus, _getSubscriberCount, _resetConnectivity,
} from './connectivity';
export {
  getOfflineSnapshot, isDirty,
  markLocalChange, markCloudSynced, markCloudFailure,
  _resetQueue, _seedQueue,
} from './queue';
export {
  triggerReplay, _getReplayToken, _resetReplay,
} from './replay';

/** Wire all offline sub-modules to the same deps. Call once at boot. */
export function registerOffline(deps: OfflineDeps): void {
  registerQueueDeps(deps);    // queue first — loads persisted snapshot
  registerConnectivityDeps(deps);
  registerReplayDeps(deps);
}
