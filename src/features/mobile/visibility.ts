// ============================================================================
// Visibility — background/foreground transitions. Phase Mobile-1.
//
// Mobile browsers fire `visibilitychange` when the user switches apps,
// locks the screen, or backgrounds the tab. We expose:
//
//   - getVisibilityState(): 'visible' | 'hidden'
//   - subscribeVisibility(fn): callback on every transition
//
// Hooks the audio domain into this so playback can resume cleanly after
// a background pause (iOS Safari sometimes silences audio on background).
// The resume call is non-invasive: it only re-issues a play() intent on
// the existing token-protected playback layer (TS-19).
// ============================================================================

export type VisibilityState = 'visible' | 'hidden';

let _state: VisibilityState = 'visible';
type Sub = (s: VisibilityState) => void;
const _subs = new Set<Sub>();
let _listenerAttached = false;
let _domListener: (() => void) | null = null;

/** Wire the visibilitychange listener once. Idempotent. */
export function initVisibility(): void {
  if (_listenerAttached) return;
  if (typeof document === 'undefined') return;
  _state = document.hidden ? 'hidden' : 'visible';
  _domListener = (): void => {
    const next: VisibilityState = document.hidden ? 'hidden' : 'visible';
    if (next === _state) return;
    _state = next;
    for (const fn of _subs) {
      try { fn(_state); } catch (e) { console.warn('[mobile/visibility] sub failed:', e); }
    }
  };
  document.addEventListener('visibilitychange', _domListener);
  _listenerAttached = true;
}

export function getVisibilityState(): VisibilityState {
  return _state;
}

export function subscribeVisibility(fn: Sub): () => boolean {
  _subs.add(fn);
  try { fn(_state); } catch { /* ignore */ }
  return () => _subs.delete(fn);
}

/** Stop listening + clear subscribers. Used by teardown + tests. */
export function teardownVisibility(): void {
  if (_domListener && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', _domListener);
  }
  _domListener = null;
  _listenerAttached = false;
  _subs.clear();
  _state = 'visible';
}

// Test hooks ----------------------------------------------------------------
export function _forceVisibility(s: VisibilityState): void {
  if (s === _state) return;
  _state = s;
  for (const fn of _subs) {
    try { fn(_state); } catch { /* ignore */ }
  }
}
export function _getSubCount(): number { return _subs.size; }
