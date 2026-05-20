// ============================================================================
// Playback — race-protected audio element control. Phase TS-19.
//
// The HTMLAudioElement is a stateful resource that produces a play() Promise
// per invocation. Rapid src swaps or back-to-back plays produce "AbortError"
// rejections that older code logs as console errors but ignores. This module
// implements "last-intent-wins" tokens so:
//
//   - Only the most recent playUrl() can transition the element to playing.
//   - Older in-flight promises are observed (their AbortError swallowed)
//     but never produce side effects on the store or UI.
//   - pause() always wins immediately (it carries the next token).
//
// CRITICAL: keep the synchronous path between user gesture and audio.play()
// short — iOS Safari's autoplay policy revokes the gesture if any await
// happens in between. The controller checks the cache synchronously and
// only awaits on a cold miss.
// ============================================================================

import type { PlayerDeps } from './types';

let _deps: PlayerDeps | null = null;
/** Monotonically incrementing intent counter. */
let _intentToken = 0;

export function registerPlaybackDeps(deps: PlayerDeps): void {
  _deps = deps;
}

/** Returns the current intent token (test hook). */
export function _getIntentToken(): number {
  return _intentToken;
}

/** Test hook: reset internal state. */
export function _resetPlayback(): void {
  _intentToken = 0;
}

/**
 * Issue a fresh play intent for the given URL. Returns the token that was
 * minted. If the audio element isn't mounted yet, the call is a no-op.
 *
 * The function is intentionally NOT async on the synchronous path: it sets
 * `audio.src` and calls `audio.play()` immediately so the user gesture
 * survives. The play() promise's resolution/rejection is handled in the
 * background and ignored if a newer intent has been issued.
 */
export function playUrl(url: string): number {
  const token = ++_intentToken;
  if (!_deps) return token;
  const audio = _deps.getAudioEl();
  if (!audio) return token;
  if (audio.src !== url) audio.src = url;
  const p = audio.play();
  if (p && typeof p.catch === 'function') {
    p.catch((err: unknown) => {
      // Newer intent has superseded us — swallow silently.
      if (token !== _intentToken) return;
      // Genuine failure for the latest intent.
      if (err && (err as { name?: string }).name === 'AbortError') return;
      // Anything else is unexpected but non-fatal (autoplay revoked etc.).
    });
  }
  return token;
}

/** Pause the audio element. Always wins (carries the next token). */
export function pause(): number {
  const token = ++_intentToken;
  if (!_deps) return token;
  const audio = _deps.getAudioEl();
  if (!audio) return token;
  try { audio.pause(); } catch { /* ignore */ }
  return token;
}

/** Resume playback on the current src. Returns the token. */
export function resume(): number {
  const token = ++_intentToken;
  if (!_deps) return token;
  const audio = _deps.getAudioEl();
  if (!audio) return token;
  const p = audio.play();
  if (p && typeof p.catch === 'function') {
    p.catch((err: unknown) => {
      if (token !== _intentToken) return;
      if (err && (err as { name?: string }).name === 'AbortError') return;
    });
  }
  return token;
}

/** Stop + clear src + reset intent. Used by hide(). */
export function stop(): number {
  const token = ++_intentToken;
  if (!_deps) return token;
  const audio = _deps.getAudioEl();
  if (!audio) return token;
  try { audio.pause(); } catch { /* ignore */ }
  try { audio.src = ''; } catch { /* ignore */ }
  return token;
}
