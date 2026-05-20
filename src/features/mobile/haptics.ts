// ============================================================================
// Haptics — centralized vibration patterns for mobile UX. Phase Mobile-1.
//
// The inline `haptic(ms)` was a thin navigator.vibrate wrapper. This
// module:
//   1. Names the patterns semantically (tap, select, success, warning,
//      error, longPress) so call sites express INTENT, not duration
//   2. Adds a global enable/disable flag respected by every call
//   3. Reads `prefers-reduced-motion` once on boot; if set, all
//      vibrations are skipped automatically
// ============================================================================

export type HapticPattern = 'tap' | 'select' | 'success' | 'warning' | 'error' | 'longPress' | 'drag';

const PATTERNS: Readonly<Record<HapticPattern, number | number[]>> = Object.freeze({
  tap: 8,
  select: 12,
  success: [12, 40, 18],
  warning: [25, 60, 25],
  error: [40, 80, 40, 80, 60],
  longPress: 20,
  drag: 15,
});

let _enabled = true;
let _reducedMotion = false;

/** Boot-time setup: caches reduced-motion preference. Called once. */
export function initHaptics(): void {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      _reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch { _reducedMotion = false; }
  }
}

/** Toggle haptic feedback at runtime (e.g. from settings). */
export function setHapticsEnabled(enabled: boolean): void {
  _enabled = !!enabled;
}

export function areHapticsEnabled(): boolean {
  return _enabled && !_reducedMotion;
}

/** Fire a named haptic pattern. No-op if haptics disabled, reduced-motion
 *  set, or `navigator.vibrate` is unsupported. */
export function haptic(pattern: HapticPattern = 'tap'): void {
  if (!areHapticsEnabled()) return;
  const p = PATTERNS[pattern];
  if (p == null) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(p);
    }
  } catch { /* ignore */ }
}

/** Legacy-compatible numeric API for the inline call sites that pass a
 *  duration in ms. Maps to the closest named pattern. */
export function hapticMs(ms: number): void {
  if (!areHapticsEnabled()) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
    }
  } catch { /* ignore */ }
}

// Test hooks ----------------------------------------------------------------
export function _resetHaptics(): void {
  _enabled = true;
  _reducedMotion = false;
}
export function _forceReducedMotion(v: boolean): void { _reducedMotion = v; }
