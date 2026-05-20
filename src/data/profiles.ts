// ============================================================================
// Data layer — Supabase profiles (load / upsert / alias). Phase TS-12.
//
// Owns CRUD against the `profiles` table. The auth domain (session.ts +
// auth-state.ts) is the CONSUMER of these helpers — auth doesn't query
// profiles itself, it asks data/profiles via the `loadProfile` lifecycle
// hook registered in main.ts.
//
// DESIGN RULES:
// - NO DOM, NO `window.X` reads.
// - Same client-injection pattern as workspace.ts. Tests pass a mock.
// - All async functions return either the row OR a typed error envelope,
//   never throw — the auth domain rollback contract (SC44) relies on this.
// ============================================================================

import type { ProfileRow } from './types';

interface SupabaseProfilesClient {
  from: (table: string) => SupabaseProfilesQuery;
}

interface SupabaseProfilesQuery {
  select: (cols: string) => SupabaseProfilesQuery;
  eq: (col: string, val: unknown) => SupabaseProfilesQuery;
  maybeSingle: () => Promise<{ data: ProfileRow | null; error: { code?: string; message: string } | null }>;
  upsert: (row: Record<string, unknown>, opts?: { onConflict?: string }) => Promise<{ error: { message: string } | null }>;
  update: (patch: Record<string, unknown>) => SupabaseProfilesUpdate;
}

interface SupabaseProfilesUpdate {
  eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }>;
}

let _client: SupabaseProfilesClient | null = null;

export function setSupabaseProfilesClient(client: SupabaseProfilesClient | null): void {
  _client = client;
}

/**
 * Load the profile row for a given user id. Returns the row or null if
 * the user has no profile yet / storage error / no client configured.
 * Does NOT throw — the caller (auth-state's signInUserOrchestrated)
 * relies on this for rollback control.
 */
export async function loadProfile(userId: string): Promise<ProfileRow | null> {
  if (!_client || !userId) return null;
  try {
    const { data, error } = await _client.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error && error.code !== 'PGRST116') {
      console.warn('loadProfile:', error);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('loadProfile threw:', e);
    return null;
  }
}

/**
 * Upsert a profile row (name + role). Used by the onboarding flow on
 * first signup. Returns true on success, false on any error.
 */
export async function ensureProfileExists(userId: string, email: string | null | undefined, name: string, role: string): Promise<ProfileRow | null> {
  if (!_client || !userId) return null;
  try {
    const upsert = await _client.from('profiles').upsert(
      { id: userId, email: email || null, name, role },
      { onConflict: 'id' },
    );
    if (upsert.error) {
      console.warn('ensureProfileExists upsert:', upsert.error);
    }
    const { data } = await _client.from('profiles').select('*').eq('id', userId).maybeSingle();
    return data;
  } catch (e) {
    console.warn('ensureProfileExists threw:', e);
    return null;
  }
}

/**
 * Update the alias field on a profile. Trimmed empty input → stored as
 * NULL so the DB column reflects "no alias" cleanly. Returns true on
 * success.
 */
export async function saveAlias(userId: string, alias: string | null | undefined): Promise<boolean> {
  if (!_client || !userId) return false;
  const value = (alias || '').trim();
  try {
    const { error } = await _client.from('profiles').update({ alias: value || null }).eq('id', userId);
    if (error) {
      console.warn('saveAlias:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('saveAlias threw:', e);
    return false;
  }
}
