// ============================================================================
// Audio cache — shared types. Phase TS-18.
//
// The audio/cover cache layer is partially DOM-coupled (hydrate) and
// partially backend-coupled (Supabase Storage fallback). Side-effects
// reach it via the deps surface below — zero `window.X` in /cache/.
// ============================================================================

/** Minimal shape of a track row from `state.tracks` that the cache reads. */
export interface CachedTrack {
  id: string;
  name?: string;
  /** Set by inline createTrack when an audio blob is saved to IDB. */
  idbAudio?: boolean;
  /** Legacy: data:URL audio (pre-IDB era). */
  audio?: string | null;
  /** Set by inline createTrack when a cover image is saved to IDB. */
  idbCover?: boolean;
  /** Supabase Storage path for audio. */
  sbAudioPath?: string;
  /** Supabase Storage path for cover. */
  sbCoverPath?: string;
  /** Metadata snapshot stored alongside the audio. */
  audioMeta?: { name?: string; type?: string; size?: number };
}

/** Cached audio descriptor returned to callers (mini-player, hydrate). */
export interface CachedAudio {
  url: string;       // object URL
  name: string;
  type: string;
  size: number;
}

/** Deps injected once at boot via registerAudioCacheDeps. */
export interface AudioCacheDeps {
  /** Read `state.tracks` (live array, may mutate between calls). */
  getTracks: () => readonly CachedTrack[];
  /** Supabase bucket name for audio blobs. */
  audioBucket: string;
  /** Supabase bucket name for cover blobs. */
  coverBucket: string;
  /** Download a blob from Supabase Storage (null on failure). */
  sbDownloadBlob: (bucket: string, path: string) => Promise<Blob | null>;
  /** Format a byte count as "1.2 MB". */
  formatBytes: (n: number) => string;
  /** Format seconds as "m:ss". */
  formatAudioTime: (s: number) => string;
  /** Return the HTML used for the empty pill slot (fallback when no audio). */
  trackAudioInitialHTML: (t: { id: string }) => string;
  /** trackId currently active in the audio store — duration probes skip it. */
  getActiveTrackId: () => string | null;
}
