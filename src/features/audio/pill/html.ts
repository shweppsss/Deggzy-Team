// ============================================================================
// Audio pill — PURE HTML builders. Phase TS-20.
//
// Two builders:
//
//   - buildTrackAudioPillHTML(t, state, durationLabel?)
//       Renders the play/pause + progress + time pill. Reflects the current
//       audio state at the moment of render: the active track shows the
//       pause icon + filled progress, every other track shows the play icon
//       + 0% fill. `_syncAllPills` keeps these in sync between renders.
//
//   - buildTrackAudioInitialHTML(t, state)
//       Top-level catalogue cell. If the track has audio (data: URL or IDB),
//       returns the pill + a meta slot. Otherwise returns the "+ load audio"
//       file-input control.
//
// Both functions are completely framework-free. The catalogue render module
// receives `buildTrackAudioInitialHTML` as a dep so it can mount the pill
// into every track card.
// ============================================================================

import { escapeHtml } from '../../../lib/format-utils';
import { PLAY_ICON_SVG, PAUSE_ICON_SVG } from './icons';
import { formatAudioTime } from './format';
import type { PillAudioState, PillTrack } from './types';

/**
 * Build the play/pause/progress pill HTML for a single track. The
 * `durationLabel` is the *fallback* time text — used when the audio store
 * has no duration yet (track not active, or active but `loadedmetadata`
 * hasn't fired yet).
 */
export function buildTrackAudioPillHTML(
  t: PillTrack,
  state: PillAudioState,
  durationLabel?: string,
): string {
  const isActive = state.trackId === t.id;
  const isPlayingHere = isActive && state.isPlaying;
  const iconHTML = isPlayingHere ? PAUSE_ICON_SVG : PLAY_ICON_SVG;
  const stateAttr = isPlayingHere ? ' data-state="playing"' : '';
  let fillPct = 0;
  if (isActive && state.duration > 0) {
    fillPct = (state.currentTime / state.duration) * 100;
  }
  const timeLabel = isActive && state.duration > 0
    ? formatAudioTime(state.duration)
    : (durationLabel || '0:00');
  return `
    <div class="track-audio" data-track-id="${escapeHtml(t.id)}">
      <button class="track-audio-play" type="button" aria-label="Lecture / pause" onclick="playTrackInMini('${escapeHtml(t.id)}')"${stateAttr}>${iconHTML}</button>
      <div class="track-audio-progress"><div class="track-audio-progress-fill" style="width:${fillPct.toFixed(2)}%"></div></div>
      <span class="track-audio-time">${timeLabel}</span>
    </div>
  `;
}

/**
 * Top-level "audio slot" for a catalogue track. Returns the pill +
 * meta-for slot when audio exists, otherwise the upload <label>.
 */
export function buildTrackAudioInitialHTML(t: PillTrack, state: PillAudioState): string {
  const hasDataUrl = !!(t.audio && typeof t.audio === 'string' && t.audio.startsWith('data:'));
  const hasIdb = !!t.idbAudio;
  if (hasDataUrl || hasIdb) {
    return (
      buildTrackAudioPillHTML(t, state) +
      `<div class="track-audio-meta" data-meta-for="${escapeHtml(t.id)}"></div>`
    );
  }
  return `
    <label class="track-audio-empty">
      + Charger l'audio (WAV / MP3 / FLAC)
      <input type="file" accept="audio/*,.wav,.mp3,.flac,.m4a,.aac,.ogg" onchange="handleTrackAudioUpload('${escapeHtml(t.id)}', event)" />
    </label>
  `;
}
