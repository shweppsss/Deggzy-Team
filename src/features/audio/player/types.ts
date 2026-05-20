// ============================================================================
// Mini-player orchestration — shared types. Phase TS-19.
//
// The player layer is a state machine over a single HTMLAudioElement.
// Every public intent (play, pause, seek, next) goes through the
// controller, which serializes them through token-protected effects so
// rapid taps + mid-flight src swaps don't produce zombie playback.
// ============================================================================

/** Minimal track shape consumed by the controller. */
export interface PlayerTrack {
  id: string;
  name?: string;
  status?: string;
  feat?: string;
}

/** Cached audio descriptor — same shape as the cache layer returns. */
export interface PlayerAudioRef {
  url: string;
  name?: string;
  type?: string;
  size?: number;
}

/** External deps injected once at boot. Everything DOM-coupled lives here. */
export interface PlayerDeps {
  /** Returns the audio element to drive (or null if not yet mounted). */
  getAudioEl: () => HTMLAudioElement | null;
  /** Resolve the audio URL for a track id (returns null on miss). */
  resolveAudio: (trackId: string) => Promise<PlayerAudioRef | null>;
  /** Synchronous read of an already-cached audio entry. */
  peekAudio: (trackId: string) => PlayerAudioRef | null;
  /** Resolve the cover URL for a track id (returns null on miss). */
  resolveCover: (trackId: string) => Promise<string | null>;
  /** Synchronous read of an already-cached cover entry. */
  peekCover: (trackId: string) => string | null;
  /** Look up a track row by id (null if not in state). */
  findTrack: (trackId: string) => PlayerTrack | null;
  /** Mutate the audio state store (TS-17). */
  setAudioState: (patch: { trackId?: string | null; isPlaying?: boolean; currentTime?: number; duration?: number; loading?: boolean }) => void;
  /** Read the active track id from the audio state store. */
  getActiveTrackId: () => string | null;
  /** Surface a one-shot user-facing message (failed resolve, etc.). */
  toast: (msg: string) => void;
  /** UI side-effect: cover URL is now available (mid-flight cover hydrate). */
  applyCover: (url: string) => void;
  /** UI side-effect: update title/sub/cover for a brand-new track. */
  applyMetadata: (track: PlayerTrack, coverUrl: string | null) => void;
  /** Persist recovery state (last trackId + currentTime). */
  persistRecovery?: (snapshot: PlayerRecoverySnapshot) => void;
  /** Read recovery state on boot (null = no snapshot). */
  loadRecovery?: () => PlayerRecoverySnapshot | null;
}

export interface PlayerRecoverySnapshot {
  trackId: string;
  currentTime: number;
  wasPlaying: boolean;
  savedAt: number;
}

/** Internal: queue entry. Today we keep the trackId only — name/cover are
 *  resolved through the deps at play time so a stale snapshot can't ship a
 *  cover that doesn't match the current state. */
export interface QueueEntry {
  trackId: string;
}
