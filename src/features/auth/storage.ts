// ============================================================================
// Auth foundation — localStorage helpers + lockout state. Phase TS-10.
//
// Pure persistence layer. No Supabase, no network, no DOM. Only:
//   - PIN lockout state (per-user counter + locked-until deadline)
//   - PIN hash storage key composition
//   - Weak-PIN blocklist (constant + helper)
//
// All functions tolerate localStorage being unavailable / throwing — they
// return safe defaults rather than propagate. This is critical because
// the PIN lock screen renders on every cold boot, BEFORE app code has a
// chance to detect storage issues.
// ============================================================================

import type { PinLockState, PinLockoutThresholds } from './types';

// ---------------------------------------------------------------------------
// Constants — exported so main.ts can re-attach the originals on window.
// ---------------------------------------------------------------------------

/** localStorage key prefix for the per-user PIN hash. */
export const LOCAL_PIN_KEY_PREFIX = 'degzzy_local_pin_';

/** Auth audit fix C — lockout escalation thresholds (failed-attempt counts). */
export const PIN_LOCKOUT_THRESHOLDS: PinLockoutThresholds = Object.freeze({
  W30S: 3,    // 3 fails  → 30 s lock
  W5MIN: 6,   // 6 fails  → 5 min lock
  W30MIN: 10, // 10 fails → 30 min lock + clearer warning
  SIGNOUT: 15, // 15 fails → force re-auth via email/password
});

/**
 * Auth audit fix A — minimal weak-PIN blocklist.
 *
 * Previously refused ~40 codes (including niche patterns like 1379/2580/6969)
 * that frustrated users into trying 5+ PINs before finding one. For a
 * collab app with per-device PIN + escalating lockout, the marginal
 * brute-force protection from blocking niche patterns was paid in real
 * abandonment of the setup flow.
 *
 * Reduced list keeps only the genuinely guessable codes:
 *   - 10 single-digit repeats (0000–9999)
 *   - 2 obvious sequences (1234, 4321)
 */
export const WEAK_PINS: ReadonlySet<string> = new Set([
  '0000', '1111', '2222', '3333', '4444',
  '5555', '6666', '7777', '8888', '9999',
  '1234', '4321',
]);

export function isWeakPin(pin: string | null | undefined): boolean {
  if (typeof pin !== 'string') return false;
  if (!/^\d{4}$/.test(pin)) return false;
  return WEAK_PINS.has(pin);
}

// ---------------------------------------------------------------------------
// Per-user lockout state — persisted in localStorage.
// All functions take an explicit `userId` so this module stays pure.
// ---------------------------------------------------------------------------

function _pinLockKey(userId: string | null | undefined): string | null {
  return userId ? 'degzzy_pin_lock_' + userId : null;
}

/**
 * Snapshot of the current lockout state for a user. Returns a zero-state
 * object if the user isn't set, storage isn't available, or the row is
 * missing / malformed.
 */
export function getPinLockState(userId: string | null | undefined): PinLockState {
  const key = _pinLockKey(userId);
  const zero: PinLockState = { count: 0, lockedUntil: 0, isLocked: false, remainingSec: 0 };
  if (!key) return zero;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return zero;
    const parsed = JSON.parse(raw) as { count?: number; lockedUntil?: number };
    const count = typeof parsed.count === 'number' ? parsed.count : 0;
    const lockedUntil = typeof parsed.lockedUntil === 'number' ? parsed.lockedUntil : 0;
    const remainingSec = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
    return { count, lockedUntil, isLocked: remainingSec > 0, remainingSec };
  } catch (_e) {
    return zero;
  }
}

/**
 * Record a failed PIN attempt — increments the counter, picks the
 * lockout window based on the new count, persists. Returns the new
 * `{ count, lockedUntil }` pair the UI uses to render the warning toast.
 */
export function recordPinFailure(userId: string | null | undefined): { count: number; lockedUntil: number } {
  const key = _pinLockKey(userId);
  if (!key) return { count: 0, lockedUntil: 0 };
  const count = (getPinLockState(userId).count || 0) + 1;
  let lockedUntil = 0;
  const T = PIN_LOCKOUT_THRESHOLDS;
  if (count >= T.SIGNOUT)      lockedUntil = Date.now() + 60 * 60 * 1000; // 1 h (signOut fires anyway)
  else if (count >= T.W30MIN)  lockedUntil = Date.now() + 30 * 60 * 1000; // 30 min
  else if (count >= T.W5MIN)   lockedUntil = Date.now() + 5 * 60 * 1000;  // 5 min
  else if (count >= T.W30S)    lockedUntil = Date.now() + 30 * 1000;      // 30 s
  try {
    localStorage.setItem(key, JSON.stringify({ count, lockedUntil }));
  } catch (_e) {
    /* storage may be unavailable (Safari private mode) — we still return
       the computed state so the UI shows the warning correctly; the
       counter just won't persist across reloads. */
  }
  return { count, lockedUntil };
}

/** Drop the lockout row for a user — called on successful PIN entry / reset. */
export function clearPinFailures(userId: string | null | undefined): void {
  const key = _pinLockKey(userId);
  if (!key) return;
  try { localStorage.removeItem(key); } catch (_e) { /* no-op */ }
}

// ---------------------------------------------------------------------------
// PIN hash storage — get / set / remove the local hash for a user.
// (Hashing itself stays inline for now — depends on crypto.subtle + the
//  v1/v2 verify flow. TS-11 will migrate `hashPin` / `verifyPin`.)
// ---------------------------------------------------------------------------

export function getStoredPinHash(userId: string | null | undefined): string | null {
  if (!userId) return null;
  try {
    return localStorage.getItem(LOCAL_PIN_KEY_PREFIX + userId);
  } catch (_e) {
    return null;
  }
}

export function setStoredPinHash(userId: string | null | undefined, hash: string): void {
  if (!userId) return;
  try {
    localStorage.setItem(LOCAL_PIN_KEY_PREFIX + userId, hash);
  } catch (_e) { /* no-op */ }
}

export function removeStoredPinHash(userId: string | null | undefined): void {
  if (!userId) return;
  try {
    localStorage.removeItem(LOCAL_PIN_KEY_PREFIX + userId);
  } catch (_e) { /* no-op */ }
}
