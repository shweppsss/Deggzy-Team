// ============================================================================
// Audio pill — shared types. Phase TS-20.
// ============================================================================

/** Minimal shape of a track row that the pill reads from. */
export interface PillTrack {
  id: string;
  /** Legacy: data:URL audio (pre-IDB era). */
  audio?: string | null;
  /** Set when an audio blob lives in IDB. */
  idbAudio?: boolean;
}

/** State shape the pill needs at HTML build time (== AudioState from TS-17). */
export interface PillAudioState {
  trackId: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loading?: boolean;
}
