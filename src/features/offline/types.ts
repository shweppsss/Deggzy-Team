// ============================================================================
// Offline-first — shared types. Phase Offline-1.
//
// The "queue" here is intentionally minimal: we don't queue individual
// mutations because the workspace save pipeline already coalesces them
// into a single debounced snapshot. What we track instead is:
//
//   - online/offline status (driven by navigator.onLine + events)
//   - "dirty" flag (true iff a save fired locally but didn't reach cloud)
//   - last successful cloud-sync timestamp
//
// On reconnect, we trigger one cloud push of the current state. The
// existing per-entity `updatedAt` stamps handle conflict resolution at
// the merge layer.
// ============================================================================

export type ConnectivityStatus = 'online' | 'offline';

export interface OfflineSnapshot {
  /** Local state version (monotonic counter incremented on every save). */
  localVersion: number;
  /** Cloud version that was last confirmed in sync. */
  cloudVersion: number;
  /** ISO timestamp of the last successful cloud push (null if never). */
  lastCloudSyncAt: string | null;
  /** True iff local has changes that haven't reached the cloud yet. */
  dirty: boolean;
}

export interface OfflineDeps {
  /** Fires the cloud push. Returns a promise that resolves on success. */
  triggerCloudPush: () => Promise<void> | void;
  /** Persist the offline snapshot (typically localStorage). */
  persistSnapshot: (snap: OfflineSnapshot) => void;
  /** Read the persisted snapshot on boot (null = fresh state). */
  loadSnapshot: () => OfflineSnapshot | null;
  /** Toast a user-facing message (online/offline transitions). */
  toast?: (msg: string) => void;
  /** Inject `navigator.onLine` lookup so harness can mock it. */
  isNavigatorOnline?: () => boolean;
  /** Inject `addEventListener('online' | 'offline')` on window — harness
   *  can swap in a fake event bus. */
  addConnectivityListener?: (type: 'online' | 'offline', fn: () => void) => void;
  removeConnectivityListener?: (type: 'online' | 'offline', fn: () => void) => void;
}
