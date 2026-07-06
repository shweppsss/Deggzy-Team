// ============================================================================
// Audio pill — DOM reconciliation. Phase TS-20.
//
// On every audio store state change, walk every `.track-audio[data-track-id]`
// node in the document and patch (a) the play/pause icon, (b) the
// "data-state" attribute on the button, (c) the progress bar fill width.
//
// Diff-aware: only touches the DOM when the value actually changes. This
// keeps the per-frame timeupdate path cheap on a busy catalogue with
// dozens of tracks visible at once.
//
// Wired as a subscriber of the TS-17 audio store via /src/main.ts.
// ============================================================================

import { PLAY_ICON_SVG, PAUSE_ICON_SVG } from './icons';
import { formatAudioTime } from './format';
import type { PillAudioState } from './types';

/** Internal: extra fields we stamp on the button element. */
type IconKeyButton = HTMLElement & { _iconKey?: 'play' | 'pause' };

/**
 * Reconcile every track-audio pill in the DOM with the given audio state.
 * Called once on first subscribe + on every store change.
 */
export function syncAllPills(state: PillAudioState): void {
  const pills = document.querySelectorAll<HTMLElement>('.track-audio[data-track-id]');
  pills.forEach((pill) => {
    const id = pill.dataset.trackId || null;
    const isActive = id === state.trackId;
    const isPlayingHere = isActive && state.isPlaying;
    const btn = pill.querySelector<IconKeyButton>('.track-audio-play');
    if (btn) {
      const wantKey: 'play' | 'pause' = isPlayingHere ? 'pause' : 'play';
      const wantIcon = isPlayingHere ? PAUSE_ICON_SVG : PLAY_ICON_SVG;
      if (btn._iconKey !== wantKey) {
        btn.innerHTML = wantIcon;
        btn._iconKey = wantKey;
      }
      const wantState = isPlayingHere ? 'playing' : '';
      if (btn.dataset.state !== wantState) btn.dataset.state = wantState;
    }
    const fill = pill.querySelector<HTMLElement>('.track-audio-progress-fill');
    if (fill) {
      let pct = 0;
      if (isActive && state.duration > 0) {
        pct = (state.currentTime / state.duration) * 100;
      }
      const wantWidth = pct.toFixed(2) + '%';
      if (fill.style.width !== wantWidth) fill.style.width = wantWidth;
    }
    // Time label: the active track shows the LIVE current position ("what
    // minute we're at"); every other pill shows its total duration. The total
    // is stashed in data-total at render time so we can restore it here when a
    // previously-active track stops being active (e.g. the user plays another).
    const timeEl = pill.querySelector<HTMLElement>('.track-audio-time');
    if (timeEl) {
      if (isActive && state.duration > 0) {
        // Keep the stashed total fresh — duration may have only just resolved.
        const total = formatAudioTime(state.duration);
        if (timeEl.dataset.total !== total) timeEl.dataset.total = total;
        const cur = formatAudioTime(state.currentTime);
        if (timeEl.textContent !== cur) timeEl.textContent = cur;
      } else {
        const total = timeEl.dataset.total || timeEl.textContent || '';
        if (timeEl.textContent !== total) timeEl.textContent = total;
      }
    }
  });
}
