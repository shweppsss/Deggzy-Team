// ============================================================================
// Auth foundation — barrel. Phase TS-10.
//
// Scope: LOCAL runtime auth only — PIN + session + storage. Network
// (Supabase signIn/signOut/onAuthStateChange, signup, OAuth) is TS-11+.
// ============================================================================

export type {
  AuthUser,
  AuthProfile,
  PinBufferState,
  PinLockState,
  PinLockoutThresholds,
} from './types';

export {
  LOCAL_PIN_KEY_PREFIX,
  PIN_LOCKOUT_THRESHOLDS,
  WEAK_PINS,
  isWeakPin,
  getPinLockState,
  recordPinFailure,
  clearPinFailures,
  getStoredPinHash,
  setStoredPinHash,
  removeStoredPinHash,
} from './storage';

export {
  getCurrentUser,
  setCurrentUser,
  getCurrentProfile,
  setCurrentProfile,
  isSignOutInProgress,
  setSignOutInProgress,
  registerPinReset,
  logoutLocalState,
} from './session';

export {
  pinKeyPress,
  pinDelete,
  pinBackspace,
  submitPinBuffer,
  resetPinBuffer,
  getPinBuffer,
  getPinLocked,
  bindPinKeypad,
  pinKeyboardHandler,
  registerPinHooks,
} from './pin';

// Auto-wire session.logoutLocalState() → pin.resetPinBuffer() at module
// load so callers don't have to register it manually. main.ts still
// imports the symbols (for the window mirrors), but the cross-wire
// inside the auth domain now happens here. Tests get the same
// behavior without bootstrapping main.ts.
import { registerPinReset } from './session';
import { resetPinBuffer as _resetPinBufferImpl } from './pin';
registerPinReset(_resetPinBufferImpl);

// TS-11 — new surfaces.
export { hashPin, verifyPin, legacyHashPin } from './crypto';

export type { AuthSession, AuthEvent, AuthStateCallback } from './supabase-auth';
export {
  setSupabaseClient,
  getSupabaseClient,
  hasSupabaseClient,
  signInWithPassword,
  signUpWithPassword,
  supabaseSignOut,
  getSession,
  onAuthStateChange,
} from './supabase-auth';

export type { AuthLifecycleHooks, SignInResult } from './auth-state';
export {
  registerAuthLifecycleHooks,
  signOutUserOrchestrated,
  signInUserOrchestrated,
  attachAuthStateListener,
  _resetSignOutTracking,
} from './auth-state';

export { wireAuthHooks } from './hooks';
