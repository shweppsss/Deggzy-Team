// ============================================================================
// Audio pill — click-to-seek on the progress bar. Phase [audio-seek-fix].
//
// The pill's `.track-audio-progress` bar had `cursor: pointer` (an affordance
// promising it's clickable) but NO seek handler — clicking it did nothing, so
// a user could not scrub / fast-forward the playing track. This wires ONE
// delegated, capture-phase listener that turns a click on the ACTIVE track's
// progress bar into a seek.
//
// WHY DELEGATION (one document listener) rather than per-pill wiring:
// pills are re-rendered via innerHTML across the catalogue + detail overlay,
// so a delegated listener survives every re-render with zero leak and zero
// re-binding. Capture phase + stopPropagation lets us beat an ancestor card's
// click handler (e.g. openDetail) so a seek tap doesn't also navigate.
//
// WHY ONLY THE ACTIVE TRACK: seeking a track that isn't loaded in the
// <audio> element is meaningless — `getAudioState().trackId` must match the
// clicked pill and the duration must be known. Non-active bars are ignored;
// the play button starts them. Works whether the active track is playing or
// paused (scrubbing a paused track is valid).
// ============================================================================

export interface PillSeekDeps {
  /** Read the audio store — we need the active track id + its duration. */
  getAudioState: () => { trackId: string | null; duration: number };
  /** Seek the active audio element to a [0..1] ratio of its duration. */
  seekToRatio: (ratio: number) => void;
}

let _deps: PillSeekDeps | null = null;
let _wired = false;

function _onClick(e: MouseEvent): void {
  if (!_deps) return;
  const target = e.target as Element | null;
  if (!target || typeof target.closest !== 'function') return;
  const progress = target.closest('.track-audio-progress') as HTMLElement | null;
  if (!progress) return;
  const pill = progress.closest('.track-audio[data-track-id]') as HTMLElement | null;
  const id = (pill && pill.dataset.trackId) || null;
  if (!id) return;
  const st = _deps.getAudioState();
  // Only the active, loaded track can be scrubbed.
  if (st.trackId !== id || !(st.duration > 0)) return;
  const rect = progress.getBoundingClientRect();
  if (rect.width <= 0) return;
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  // Beat any ancestor card click handler (e.g. openDetail): a seek tap must
  // not also navigate. Safe because the progress bar has no own click handler.
  e.stopPropagation();
  _deps.seekToRatio(ratio);
}

/**
 * Wire the delegated seek listener. Idempotent — the first call attaches the
 * capture-phase listener; later calls just refresh the injected deps.
 */
export function initPillSeek(deps: PillSeekDeps): void {
  _deps = deps;
  if (_wired) return;
  _wired = true;
  document.addEventListener('click', _onClick, true);
}

// Test hook — detach + reset.
export function _resetPillSeek(): void {
  if (_wired) document.removeEventListener('click', _onClick, true);
  _wired = false;
  _deps = null;
}
