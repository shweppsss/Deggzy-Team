// ============================================================================
// Seek — drag/scrub control + last-intent-wins. Phase TS-19.
//
// Seeking races with playback events: a slow seek on a long track produces
// `seeking → seeked` transitions that fire timeupdate in between. We
// monotonically increment a seek token so a later seek always wins, and
// the UI only renders the most recent target position.
// ============================================================================

import type { PlayerDeps } from './types';

let _deps: PlayerDeps | null = null;
let _seekToken = 0;

export function registerSeekDeps(deps: PlayerDeps): void {
  _deps = deps;
}

/** Test hook: read seek token. */
export function _getSeekToken(): number {
  return _seekToken;
}

/** Test hook: reset state. */
export function _resetSeek(): void {
  _seekToken = 0;
}

/**
 * Set audio.currentTime to a given seconds value. Clamped to [0, duration].
 * Returns the token of this intent — callers that race with us can compare
 * against `_getSeekToken()` to know if they were superseded.
 */
export function seekToSeconds(seconds: number): number {
  const token = ++_seekToken;
  if (!_deps) return token;
  const audio = _deps.getAudioEl();
  if (!audio) return token;
  const dur = isFinite(audio.duration) ? audio.duration : 0;
  const clamped = Math.max(0, Math.min(dur > 0 ? dur : seconds, seconds));
  try { audio.currentTime = clamped; } catch { /* ignore */ }
  return token;
}

/**
 * Set audio.currentTime to a ratio [0..1] of the current duration.
 * Used by the scrubber click handler.
 */
export function seekToRatio(ratio: number): number {
  const token = ++_seekToken;
  if (!_deps) return token;
  const audio = _deps.getAudioEl();
  if (!audio || !audio.duration || isNaN(audio.duration)) return token;
  const r = Math.max(0, Math.min(1, ratio));
  try { audio.currentTime = r * audio.duration; } catch { /* ignore */ }
  return token;
}
