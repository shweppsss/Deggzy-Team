// ============================================================================
// Audio continuity — resume playback after background/foreground swap.
// Phase Mobile-1.
//
// iOS Safari silences playback when the tab is hidden long enough. When
// the user returns we re-issue a play() intent on the same track if the
// store says we were playing. The TS-19 token-protected playback layer
// makes this idempotent — older intents are observed but silently exit.
//
// On hidden → visible transition: if audio store says isPlaying=true,
// fire playerResume() so the audio element re-engages.
// ============================================================================

import { subscribeVisibility } from './visibility';

export interface AudioContinuityDeps {
  isPlaying: () => boolean;
  resume: () => void;
}

let _deps: AudioContinuityDeps | null = null;
let _unsub: (() => boolean) | null = null;
let _hidden = false;

export function registerAudioContinuity(deps: AudioContinuityDeps): void {
  _deps = deps;
  if (_unsub) return; // idempotent
  _unsub = subscribeVisibility((state) => {
    const wasHidden = _hidden;
    _hidden = state === 'hidden';
    if (state === 'visible' && wasHidden) {
      if (_deps && _deps.isPlaying()) {
        try { _deps.resume(); } catch (e) { console.warn('[mobile/audio-continuity] resume failed:', e); }
      }
    }
  });
}

/** Test hook: tear down. */
export function _resetAudioContinuity(): void {
  if (_unsub) { _unsub(); _unsub = null; }
  _hidden = false;
  _deps = null;
}
