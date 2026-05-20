// ============================================================================
// View transitions — gentle page-swap animations. Phase Mobile-1.
//
// Uses the View Transitions API (Chrome 111+, Safari 18+) when available,
// falls back to a no-op otherwise. Each call swaps the DOM via the
// provided callback inside a transition wrapper, so the browser animates
// the cross-fade automatically.
//
// `prefers-reduced-motion` is respected — the wrapper degrades to a
// straight callback call.
// ============================================================================

type DocWithTransitions = Document & {
  startViewTransition?: (cb: () => void) => { finished: Promise<void> };
};

let _enabled = true;

export function setTransitionsEnabled(enabled: boolean): void {
  _enabled = !!enabled;
}

export function areTransitionsEnabled(): boolean {
  return _enabled;
}

function _reducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch { return false; }
}

/**
 * Run `swap` inside a View Transition. Returns a promise that resolves
 * when the transition finishes (or immediately if unsupported / disabled
 * / reduced-motion).
 */
export function viewTransition(swap: () => void): Promise<void> {
  if (!_enabled || _reducedMotion()) {
    try { swap(); } catch (e) { console.warn('[mobile/transitions] swap threw:', e); }
    return Promise.resolve();
  }
  const doc = typeof document !== 'undefined' ? (document as DocWithTransitions) : null;
  if (!doc || typeof doc.startViewTransition !== 'function') {
    try { swap(); } catch (e) { console.warn('[mobile/transitions] swap threw:', e); }
    return Promise.resolve();
  }
  try {
    const t = doc.startViewTransition(() => { swap(); });
    return t.finished.catch(() => { /* aborted is fine */ });
  } catch (e) {
    console.warn('[mobile/transitions] startViewTransition threw:', e);
    try { swap(); } catch { /* ignore */ }
    return Promise.resolve();
  }
}

// Test hooks ----------------------------------------------------------------
export function _resetTransitions(): void { _enabled = true; }
