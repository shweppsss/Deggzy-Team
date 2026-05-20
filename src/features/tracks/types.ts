// ============================================================================
// Track CRUD — shared types. Phase TS-21.
//
// "Track" here is the catalogue row + every audio/cover/IDB pointer the
// mutations need to keep consistent. The mutation module owns the full
// flow: validate → patch → save → render → cache cleanup → rollback.
// ============================================================================

/** Catalogue track row. Most fields are user-editable strings; a few flags
 *  track which sub-resources (audio/cover blobs) the row owns. */
export interface Track {
  id: string;
  name: string;
  releaseDate?: string;
  status?: string;
  bpm?: string;
  duration?: string;
  feat?: string;
  notes?: string;
  cover?: string | null;
  audio?: string | null;
  idbAudio?: boolean;
  idbCover?: boolean;
  audioMeta?: { name?: string; type?: string; size?: number } | null;
  sbAudioPath?: string;
  sbCoverPath?: string;
  // Any other field the catalogue persists.
  [key: string]: unknown;
}

/** Side-effect host. Injected once at boot via registerTrackDeps. */
export interface TrackDeps {
  /** Read the current tracks array (live reference; treat as readonly). */
  getTracks: () => Track[];
  /** Replace the tracks array on `state.tracks`. */
  replaceTracks: (next: Track[]) => void;
  /** Persist current state (cloud + IDB). */
  save: () => void;
  /** Re-render the catalogue grid. */
  renderCatalogue: () => void;
  /** Re-render every section (used after detail-pane delete). */
  renderAll: () => void;
  /** Native confirm() prompt. Returns true on accept. */
  confirm: (message: string) => boolean;
  /** Toast a confirmation/error message. */
  toast: (msg: string) => void;
  /** Close the detail overlay (used by detail-pane delete path). */
  closeDetail: () => void;
  /** Revoke + drop the in-memory audio blob URL for a track. */
  clearAudioCache: (trackId: string) => void;
  /** Revoke + drop the in-memory cover blob URL for a track. */
  clearCoverCache: (trackId: string) => void;
  /** Delete the IDB record under `track_<id>`. */
  idbDeleteAudio: (key: string) => Promise<void>;
  /** Delete the IDB cover record under `cover_<id>`. */
  idbDeleteCover: (key: string) => Promise<void>;
  /** Deterministic clock — injected so tests can pin track ids. Defaults
   *  to Date.now() when registered from main.ts. */
  now?: () => number;
}

/** Patch shape for createTrack — every field is optional, defaults apply. */
export type TrackCreatePatch = Partial<Omit<Track, 'id'>>;

/** Patch shape for updateTrack — partial set of fields to write. */
export type TrackUpdatePatch = Partial<Omit<Track, 'id'>>;
