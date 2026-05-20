// ============================================================================
// Audio element lifecycle — listener leak detection. Phase TS-19.
//
// The mini-player wires several listeners on its <audio> element. If init()
// runs twice (sync race, hot reload), we'd double-bind every listener. This
// module exposes idempotent attach/detach helpers and tracks every listener
// so the harness can verify no leaks across N open/close cycles.
//
// NOTE: The actual MiniPlayer DOM listeners (play button click, scrubber)
// stay in /src/features/mini-player.ts because they're tightly coupled to
// the pill DOM. This module owns ONLY the <audio> element event listeners
// that drive the orchestration layer (ended → autoplay, timeupdate →
// recovery snapshot, etc.).
// ============================================================================

import type { PlayerDeps } from './types';

let _deps: PlayerDeps | null = null;
let _attached = false;

interface AttachedListener {
  type: string;
  fn: EventListener;
}
const _listeners: AttachedListener[] = [];

export function registerElementDeps(deps: PlayerDeps): void {
  _deps = deps;
}

/**
 * Attach orchestration listeners to the audio element. Idempotent — no-op
 * if already attached. Returns true if a fresh attach happened.
 */
export function attachOrchestration(handlers: {
  onEnded: () => void;
  onTimeUpdate: () => void;
}): boolean {
  if (_attached) return false;
  if (!_deps) return false;
  const audio = _deps.getAudioEl();
  if (!audio) return false;
  const onEnded: EventListener = () => handlers.onEnded();
  const onTimeUpdate: EventListener = () => handlers.onTimeUpdate();
  audio.addEventListener('ended', onEnded);
  audio.addEventListener('timeupdate', onTimeUpdate);
  _listeners.push({ type: 'ended', fn: onEnded });
  _listeners.push({ type: 'timeupdate', fn: onTimeUpdate });
  _attached = true;
  return true;
}

/** Detach all orchestration listeners. Idempotent. Returns count removed. */
export function detachOrchestration(): number {
  if (!_attached) return 0;
  if (!_deps) { _attached = false; return 0; }
  const audio = _deps.getAudioEl();
  let n = 0;
  if (audio) {
    for (const l of _listeners) {
      audio.removeEventListener(l.type, l.fn);
      n++;
    }
  }
  _listeners.length = 0;
  _attached = false;
  return n;
}

/** Test hook: current attached listener count. */
export function _getListenerCount(): number {
  return _listeners.length;
}

/** Test hook: full reset — detaches every listener from the audio element
 *  before clearing internal tracking. Without the detach, repeated
 *  attach/reset cycles would leak listeners on the DOM element. */
export function _resetElement(): void {
  detachOrchestration();
}
