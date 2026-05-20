// ============================================================================
// Auth foundation — session runtime state. Phase TS-10.
//
// Holds the LOCAL runtime user/profile/sign-out-flag. NOT the network
// layer — Supabase signIn/signOut/auth state change handlers stay inline
// (TS-11 scope). This module is the single TS source of truth for who
// the current user is, locally.
//
// Inline code reads these via the `_currentUser` / `_currentProfile` /
// `_signOutInProgress` bare globals — main.ts mirrors them via
// `Object.defineProperty(window, 'X', { get, set })` so the inline
// reads/writes resolve to our module-private state.
// ============================================================================

import type { AuthUser, AuthProfile } from './types';

// Module-private state — single source of truth.
let _currentUser: AuthUser | null = null;
let _currentProfile: AuthProfile | null = null;
let _signOutInProgress = false;

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export function getCurrentUser(): AuthUser | null {
  return _currentUser;
}

export function setCurrentUser(user: AuthUser | null): void {
  _currentUser = user;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function getCurrentProfile(): AuthProfile | null {
  return _currentProfile;
}

export function setCurrentProfile(profile: AuthProfile | null): void {
  _currentProfile = profile;
}

// ---------------------------------------------------------------------------
// Sign-out flag — true while OUR own sign-out is running, so the Supabase
// onAuthStateChange SIGNED_OUT callback (inline) doesn't race with our
// own location.reload(). The inline callback reads this flag to bail.
// ---------------------------------------------------------------------------

export function isSignOutInProgress(): boolean {
  return _signOutInProgress;
}

export function setSignOutInProgress(value: boolean): void {
  _signOutInProgress = value;
}

// ---------------------------------------------------------------------------
// Local logout cleanup — the SYNC parts of sign-out:
//   - clear in-memory user / profile
//   - clear PIN buffer (delegates to pin.ts via the bridge below)
// The network parts (sb.auth.signOut + location.reload) stay inline and
// call `logoutLocalState()` before doing their async cleanup.
// ---------------------------------------------------------------------------

/** Imported lazily to avoid a circular dep with pin.ts. */
type PinResetFn = () => void;
let _pinResetFn: PinResetFn | null = null;

/**
 * Register the PIN reset function from pin.ts. main.ts calls this once
 * during boot. Keeps session.ts independent of pin.ts at the module
 * level so each can be tested in isolation.
 */
export function registerPinReset(fn: PinResetFn): void {
  _pinResetFn = fn;
}

/**
 * Local logout cleanup — clears in-memory user/profile + PIN buffer.
 * Idempotent: safe to call multiple times. Returns nothing — the caller
 * (still inline `signOutUser`) is responsible for the network call +
 * location.reload().
 */
export function logoutLocalState(): void {
  _currentUser = null;
  _currentProfile = null;
  if (_pinResetFn) {
    try { _pinResetFn(); } catch (_e) { /* never let cleanup throw */ }
  }
  // Note: we intentionally DO NOT reset _signOutInProgress here. The
  // inline signOutUser sets it to true at the start and reads it from
  // the auth-state-change listener until the page reload — its lifetime
  // is the caller's responsibility.
}
