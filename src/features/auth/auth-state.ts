// ============================================================================
// Auth foundation — auth state orchestration. Phase TS-11.
//
// Owns the SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED / PASSWORD_RECOVERY
// transitions. Coordinates:
//   - session.ts state mutations (currentUser / currentProfile)
//   - pin.ts buffer reset (via logoutLocalState)
//   - supabase-auth.ts network calls (signOut)
//   - inline cleanup callbacks (realtime channels, page reload) via
//     `registerAuthLifecycleHooks()`
//
// The CONCURRENT-LOGOUT GUARD lives here: `signOutUserOrchestrated()` is
// idempotent — repeated calls bail on the second entry by reading
// `isSignOutInProgress()`. SC43 pins this.
//
// FAILED-SIGNIN ROLLBACK also lives here: `signInUserOrchestrated()`
// guarantees that if Supabase rejects OR if subsequent hydration throws,
// the local state is restored to the pre-attempt snapshot (currentUser /
// currentProfile / lockout row). SC44 pins this.
// ============================================================================

import {
  getCurrentUser,
  setCurrentUser,
  getCurrentProfile,
  setCurrentProfile,
  isSignOutInProgress,
  setSignOutInProgress,
  logoutLocalState,
} from './session';
import {
  signInWithPassword,
  supabaseSignOut,
  onAuthStateChange,
  type AuthEvent,
  type AuthSession,
} from './supabase-auth';
import type { AuthUser, AuthProfile } from './types';

// ---------------------------------------------------------------------------
// Lifecycle hooks — inline code injects these at boot for the side-effects
// the orchestrator needs to perform but doesn't own (realtime tear-down,
// page reload, profile hydration query, etc.).
// ---------------------------------------------------------------------------

export interface AuthLifecycleHooks {
  /** Tear down any realtime channels (workspace / activity / presence). */
  cleanupRealtimeChannels?: () => void;
  /** Reload the page — typically last step of SIGNED_OUT cleanup. */
  reload?: () => void;
  /** Load the user's profile from the cloud after a successful signIn. */
  loadProfile?: () => Promise<AuthProfile | null>;
  /** Post-auth flow: hides auth UI, subscribes to realtime, renders app. */
  postAuthFlow?: () => Promise<void> | void;
  /** Show the password-recovery UI. */
  showResetPassword?: () => void;
}

let _hooks: AuthLifecycleHooks = {};

export function registerAuthLifecycleHooks(hooks: AuthLifecycleHooks): void {
  _hooks = { ..._hooks, ...hooks };
}

// ---------------------------------------------------------------------------
// signOut orchestration — concurrent-safe.
// ---------------------------------------------------------------------------

let _signOutCompletedResolver: (() => void) | null = null;
let _signOutCompletedPromise: Promise<void> | null = null;

/** Reset internal sign-out tracking (test-only). */
export function _resetSignOutTracking(): void {
  _signOutCompletedResolver = null;
  _signOutCompletedPromise = null;
  setSignOutInProgress(false);
}

/**
 * Full signOut flow — idempotent, concurrent-safe.
 *
 * Contract (verified by SC43):
 *   - First call sets `_signOutInProgress=true`, runs the full sequence:
 *     supabaseSignOut → cleanupRealtimeChannels → logoutLocalState → reload.
 *   - Concurrent calls return immediately with the SAME promise — they do
 *     NOT trigger a second Supabase request or a second reload.
 *   - The flag stays `true` until the page reloads (the caller is the
 *     reload owner) so the inline `onAuthStateChange` SIGNED_OUT handler
 *     reads it correctly and skips its own reload.
 */
export async function signOutUserOrchestrated(): Promise<void> {
  if (isSignOutInProgress()) {
    // Second concurrent call — return the promise the first call owns
    // so both awaiters resolve together when sequence completes.
    return _signOutCompletedPromise || Promise.resolve();
  }
  setSignOutInProgress(true);
  _signOutCompletedPromise = new Promise<void>((resolve) => {
    _signOutCompletedResolver = resolve;
  });

  try {
    // 1. Network signOut — best-effort; we proceed with local cleanup
    //    even if the server call errors (matches the inline behavior).
    try { await supabaseSignOut(); } catch (_e) { /* swallow */ }

    // 2. Tear down realtime channels — still inline, hook injection.
    if (_hooks.cleanupRealtimeChannels) {
      try { _hooks.cleanupRealtimeChannels(); } catch (_e) { /* never fail cleanup */ }
    }

    // 3. Local state cleanup (clears user / profile / PIN buffer).
    logoutLocalState();

    // 4. Reload — page is unloaded by the host environment; resolver fires
    //    BEFORE the navigation actually happens so any awaiting test code
    //    can observe the post-cleanup state synchronously.
    if (_signOutCompletedResolver) _signOutCompletedResolver();
    _signOutCompletedResolver = null;

    if (_hooks.reload) {
      try { _hooks.reload(); } catch (_e) { /* no-op */ }
    }
  } catch (e) {
    // Any synchronous failure inside the orchestration: release the
    // signOutInProgress flag so a follow-up attempt isn't blocked.
    console.error('signOutUserOrchestrated failed:', e);
    if (_signOutCompletedResolver) _signOutCompletedResolver();
    _signOutCompletedResolver = null;
    setSignOutInProgress(false);
  }
}

// ---------------------------------------------------------------------------
// signIn orchestration — atomic with rollback on failure.
// ---------------------------------------------------------------------------

export interface SignInResult {
  ok: boolean;
  user: AuthUser | null;
  errorMessage?: string;
}

/**
 * Sign in with email/password, hydrate profile, and run the post-auth flow.
 *
 * Contract (verified by SC44):
 *   - Snapshot of (currentUser, currentProfile) taken BEFORE the attempt.
 *   - On Supabase reject OR on a thrown profile hydration / postAuthFlow:
 *     state is restored to the snapshot AND no stale user/profile sticks.
 *   - The lockout-row counter in storage.ts is NOT touched here — that
 *     stays the caller's responsibility (the inline `recordAuthFailure` /
 *     `clearAuthFailures` lockout layer is separate from the PIN lockout).
 */
export async function signInUserOrchestrated(email: string, password: string): Promise<SignInResult> {
  // Snapshot for rollback
  const prevUser = getCurrentUser();
  const prevProfile = getCurrentProfile();

  try {
    const { data, error } = await signInWithPassword(email, password);
    if (error || !data || !data.user) {
      return { ok: false, user: null, errorMessage: error?.message || 'signIn returned no user' };
    }

    // Provisionally set the new user — profile hydration follows.
    setCurrentUser(data.user);

    // Hydrate profile from the cloud (inline hook).
    if (_hooks.loadProfile) {
      const profile = await _hooks.loadProfile();
      if (profile) setCurrentProfile(profile);
    }

    // Run post-auth UI flow (hide auth, render app, subscribe realtime).
    if (_hooks.postAuthFlow) {
      await _hooks.postAuthFlow();
    }

    return { ok: true, user: data.user };
  } catch (e) {
    // ROLLBACK — any error anywhere in the sequence restores prior state.
    setCurrentUser(prevUser);
    setCurrentProfile(prevProfile);
    return { ok: false, user: null, errorMessage: (e as Error).message || 'signIn threw' };
  }
}

// ---------------------------------------------------------------------------
// onAuthStateChange dispatcher — subscribes to Supabase events and routes
// them through the lifecycle hooks. Called once by main.ts after the
// Supabase client is configured.
// ---------------------------------------------------------------------------

let _authStateUnsubscribe: (() => void) | null = null;

/**
 * Wire up the Supabase onAuthStateChange listener. Idempotent: a second
 * call unsubscribes the previous listener first. Returns the unsubscribe
 * function for tests / for explicit teardown.
 */
export function attachAuthStateListener(): () => void {
  if (_authStateUnsubscribe) {
    try { _authStateUnsubscribe(); } catch (_e) { /* no-op */ }
    _authStateUnsubscribe = null;
  }
  _authStateUnsubscribe = onAuthStateChange((event: AuthEvent, session: AuthSession | null) => {
    console.log('[Auth] event:', event);
    if (event === 'PASSWORD_RECOVERY') {
      setCurrentUser(session ? session.user : null);
      if (_hooks.showResetPassword) _hooks.showResetPassword();
      return;
    }
    if (event === 'SIGNED_OUT') {
      setCurrentUser(null);
      setCurrentProfile(null);
      if (_hooks.cleanupRealtimeChannels) {
        try { _hooks.cleanupRealtimeChannels(); } catch (_e) { /* no-op */ }
      }
      // Skip the reload if we initiated the signOut ourselves —
      // signOutUserOrchestrated already reloads, and a double-reload
      // race can cancel the first one.
      if (!isSignOutInProgress() && _hooks.reload) {
        try { _hooks.reload(); } catch (_e) { /* no-op */ }
      }
    }
  });
  return () => {
    if (_authStateUnsubscribe) {
      try { _authStateUnsubscribe(); } catch (_e) { /* no-op */ }
      _authStateUnsubscribe = null;
    }
  };
}
