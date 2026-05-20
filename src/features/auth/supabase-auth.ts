// ============================================================================
// Auth foundation — Supabase auth client wrappers. Phase TS-11.
//
// Thin typed wrappers around the Supabase auth client (signIn/signUp/
// signOut/getSession/onAuthStateChange). The Supabase JS client itself
// (`window.supabase.createClient(...)`) stays inline — initialization
// happens before this module loads and the resulting client is INJECTED
// here via `setSupabaseClient()`.
//
// EXPLICITLY OUT OF SCOPE:
// - Realtime app-wide subscriptions (workspace state, presence, activity).
//   Those stay inline (`subscribeToWorkspaceRealtime` etc.) and migrate
//   in TS-12+.
// - Data-fetch wrappers (profiles SELECT/UPSERT, workspace SELECT/UPSERT).
//   Those stay inline; migrate alongside the workspace state in TS-12+.
// - WebAuthn enrollment — separate concern.
//
// DESIGN RULES:
// - This module DOES NOT touch `window.X`. The client comes from the
//   injection point. Tests pass a mock client.
// - All async functions return typed result envelopes so the caller can
//   distinguish data vs error without try/catch flow control everywhere.
// ============================================================================

import type { AuthUser } from './types';

// ---------------------------------------------------------------------------
// Minimal types — describes only the subset of the Supabase auth client
// this module needs. Refines as we migrate.
// ---------------------------------------------------------------------------

export interface AuthSession {
  user: AuthUser;
  // The actual session payload has access_token etc., but we don't need
  // them for the lifecycle the TS layer owns.
  [key: string]: unknown;
}

export type AuthEvent =
  | 'INITIAL_SESSION'
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  | 'PASSWORD_RECOVERY';

export type AuthStateCallback = (event: AuthEvent, session: AuthSession | null) => void;

interface SupabaseAuthClient {
  signInWithPassword: (creds: { email: string; password: string }) => Promise<{ data: { user: AuthUser | null; session: AuthSession | null } | null; error: { message: string; code?: string } | null }>;
  signUp: (payload: { email: string; password: string; options?: unknown }) => Promise<{ data: { user: AuthUser | null; session: AuthSession | null } | null; error: { message: string; code?: string } | null }>;
  signOut: () => Promise<{ error: { message: string } | null }>;
  getSession: () => Promise<{ data: { session: AuthSession | null } | null; error: { message: string } | null }>;
  onAuthStateChange: (cb: AuthStateCallback) => { data: { subscription: { unsubscribe: () => void } } } | { subscription?: { unsubscribe?: () => void } } | unknown;
}

interface SupabaseClient {
  auth: SupabaseAuthClient;
}

// ---------------------------------------------------------------------------
// Client injection — main.ts calls setSupabaseClient(window.sb) at boot;
// the harness calls it with a mock.
// ---------------------------------------------------------------------------

let _client: SupabaseClient | null = null;

export function setSupabaseClient(client: SupabaseClient | null): void {
  _client = client;
}

export function getSupabaseClient(): SupabaseClient | null {
  return _client;
}

export function hasSupabaseClient(): boolean {
  return _client !== null;
}

// ---------------------------------------------------------------------------
// signIn / signUp / signOut / getSession / onAuthStateChange wrappers.
// Each returns the raw Supabase shape so callers can switch on `error`.
// If no client is configured, returns a synthetic "no-client" error.
// ---------------------------------------------------------------------------

const NO_CLIENT_ERROR = { message: 'Supabase client not configured', code: 'no_client' };

export async function signInWithPassword(email: string, password: string): Promise<{ data: { user: AuthUser | null; session: AuthSession | null } | null; error: { message: string; code?: string } | null }> {
  if (!_client) return { data: null, error: NO_CLIENT_ERROR };
  return _client.auth.signInWithPassword({ email, password });
}

export async function signUpWithPassword(email: string, password: string, options?: unknown): Promise<{ data: { user: AuthUser | null; session: AuthSession | null } | null; error: { message: string; code?: string } | null }> {
  if (!_client) return { data: null, error: NO_CLIENT_ERROR };
  return _client.auth.signUp({ email, password, options });
}

export async function supabaseSignOut(): Promise<{ error: { message: string } | null }> {
  if (!_client) return { error: null }; // soft-fail when no client — local cleanup still runs
  try {
    return await _client.auth.signOut();
  } catch (e) {
    return { error: { message: (e as Error).message || 'signOut threw' } };
  }
}

export async function getSession(): Promise<AuthSession | null> {
  if (!_client) return null;
  try {
    const { data } = await _client.auth.getSession();
    return data?.session || null;
  } catch (_e) {
    return null;
  }
}

/**
 * Subscribe to auth-state events. Returns an unsubscribe function so the
 * caller can detach cleanly (used by tests + by logout cleanup).
 */
export function onAuthStateChange(callback: AuthStateCallback): () => void {
  if (!_client) return () => { /* no-op */ };
  const sub = _client.auth.onAuthStateChange(callback);
  // Supabase JS v2 shape: { data: { subscription: { unsubscribe } } }
  // We accept both v2 and a looser shape for defensive testability.
  const s = sub as { data?: { subscription?: { unsubscribe?: () => void } }; subscription?: { unsubscribe?: () => void } };
  const unsub = s?.data?.subscription?.unsubscribe || s?.subscription?.unsubscribe;
  return typeof unsub === 'function' ? unsub.bind(null) : () => { /* no-op */ };
}
