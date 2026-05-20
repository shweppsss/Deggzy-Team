// ============================================================================
// Realtime collab — barrel. Phase Realtime-1.
//
// Single `registerRealtime(deps)` entry wires presence + broadcast + feed.
// Returns a small handle so the caller can stop everything cleanly on
// auth logout / teardown.
// ============================================================================

import type { RealtimeDeps } from './types';
import { registerPresenceDeps, stopPresencePolling, _resetPresence } from './presence';
import { registerBroadcastDeps, stopBroadcast, _resetBroadcast } from './broadcast';
import { startActivityFeed, stopActivityFeed, _resetActivityFeed } from './activity-feed';

export type { PresenceUser, ActivityEvent, ActivityEventKind, RealtimeDeps, RealtimeChannel } from './types';
export { getOnlineUsers, getOnlineCount, subscribePresence, _forceRefresh, _resetPresence } from './presence';
export { broadcastActivity, subscribeActivity, _injectRemoteEvent, _resetBroadcast, _getSeenCount, _getChannel } from './broadcast';
export { startActivityFeed, stopActivityFeed, getActivityEvents, subscribeActivityFeed, appendLocalActivity, _resetActivityFeed, _getFeedSize } from './activity-feed';

export interface RealtimeHandle {
  stop: () => void;
}

/** Wire every realtime sub-module + start the activity feed. Returns a
 *  handle for clean teardown on logout / teardown. */
export function registerRealtime(deps: RealtimeDeps): RealtimeHandle {
  registerPresenceDeps(deps);
  registerBroadcastDeps(deps);
  startActivityFeed();
  return {
    stop: () => {
      stopActivityFeed();
      stopBroadcast();
      stopPresencePolling();
    },
  };
}

/** Test hook: tear everything down. */
export function _resetRealtime(): void {
  _resetActivityFeed();
  _resetBroadcast();
  _resetPresence();
}
