// ============================================================================
// Audio state store — single source of truth for the currently-loaded track
// and its playback timeline. Phase TS-17.
//
// Why a store? The DOM is full of track-audio pills (catalogue, detail
// overlays, search results, ...). They all render once based on the
// state at render time, then sync via a subscriber. So a pill mounted
// AFTER playback started still picks up "playing" on the next reconcile
// pass — no per-pill bookkeeping needed.
//
// Zero `window.X` references in this file.
// ============================================================================

export interface AudioState {
  /** Currently loaded track id, or null. */
  trackId: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loading: boolean;
}

export type AudioStateSubscriber = (state: Readonly<AudioState>) => void;

/** Module-private mutable state. Reads via `getAudioState()`. */
const _audioState: AudioState = {
  trackId: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  loading: false,
};

const _subscribers = new Set<AudioStateSubscriber>();

/** Read the current state (live reference; callers MUST NOT mutate). */
export function getAudioState(): Readonly<AudioState> {
  return _audioState;
}

/**
 * Subscribe to state changes. Fires once synchronously with the current state.
 * Returns an unsubscribe handle.
 */
export function subscribeAudio(fn: AudioStateSubscriber): () => boolean {
  _subscribers.add(fn);
  try { fn(_audioState); } catch { /* subscriber errors must not break others */ }
  return () => _subscribers.delete(fn);
}

/**
 * Apply a partial patch. Only fields whose value actually changes count as
 * dirty; subscribers fire iff at least one field changed. This makes the
 * per-frame `timeupdate` path cheap when paused or seeking inside the
 * same second.
 */
export function setAudioState(patch: Partial<AudioState>): void {
  let changed = false;
  for (const k in patch) {
    const key = k as keyof AudioState;
    const next = patch[key];
    if (next !== undefined && _audioState[key] !== next) {
      // Object.assign signature isn't tight enough for the discriminated union; do per-field.
      (_audioState as unknown as Record<string, unknown>)[key] = next as unknown;
      changed = true;
    }
  }
  if (!changed) return;
  for (const fn of _subscribers) {
    try { fn(_audioState); } catch (e) { console.warn('[audio] subscriber failed:', e); }
  }
}

/**
 * Wire a single `<audio>` element to the store. Idempotent — guarded by a
 * marker on the element so MiniPlayer.init() can be called multiple times.
 * `timeupdate` is throttled via rAF (timeupdate fires 60+ Hz).
 */
type HookableAudio = HTMLAudioElement & { _noNameStoreBound?: boolean };
export function hookAudioToStore(audio: HookableAudio | null | undefined): void {
  if (!audio || audio._noNameStoreBound) return;
  audio._noNameStoreBound = true;
  let rafScheduled = false;
  audio.addEventListener('play', () => setAudioState({ isPlaying: true, loading: false }));
  audio.addEventListener('pause', () => setAudioState({ isPlaying: false }));
  audio.addEventListener('ended', () => setAudioState({ isPlaying: false, currentTime: 0 }));
  audio.addEventListener('loadedmetadata', () => setAudioState({ duration: audio.duration || 0 }));
  audio.addEventListener('durationchange', () => setAudioState({ duration: audio.duration || 0 }));
  audio.addEventListener('loadstart', () => setAudioState({ loading: true }));
  audio.addEventListener('canplay', () => setAudioState({ loading: false }));
  audio.addEventListener('error', () => setAudioState({ loading: false }));
  audio.addEventListener('timeupdate', () => {
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
      rafScheduled = false;
      setAudioState({ currentTime: audio.currentTime });
    });
  });
}

/** Test hook: reset to initial state + clear subscribers. */
export function _resetAudioStore(): void {
  _audioState.trackId = null;
  _audioState.isPlaying = false;
  _audioState.currentTime = 0;
  _audioState.duration = 0;
  _audioState.loading = false;
  _subscribers.clear();
}

/** Test hook: subscriber count. */
export function _getSubscriberCount(): number {
  return _subscribers.size;
}
