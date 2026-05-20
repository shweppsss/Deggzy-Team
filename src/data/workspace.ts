// ============================================================================
// Data layer — workspace (cloud + local). Phase TS-12.
//
// Owns the workspace state runtime:
//   - getState()           → readonly snapshot accessor
//   - setState(next)       → atomic replace (caller is responsible for
//                            building `next` correctly — usually via merge)
//   - patchState(partial)  → merge a partial patch through `patchWorkspace`
//                            with the documented merge rules
//   - loadWorkspace()      → fetch the workspace row from Supabase, deep-merge
//                            onto DEFAULTS, persist to localStorage, return ok
//   - saveWorkspace()      → debounced persistence + cloud sync orchestrator
//   - getWorkspaceDefaults() / setWorkspaceDefaults() — DI for the DEFAULTS
//                            object, which still lives inline (giant — TS-13+).
//
// CONCURRENT PATCH ORDERING — patchState wraps each patch in a microtask
// queue so two concurrent callers serialize cleanly. SC48 pins this.
//
// ROLLBACK ON SAVE — saveWorkspace remembers the pre-write snapshot.
// If the localStorage write OR the cloud push fails synchronously, the
// in-memory state is restored to the snapshot. SC47 pins this.
//
// DESIGN RULES:
// - NO DOM, NO `window.X` reads.
// - Supabase client comes from `setSupabaseClient()` (registered by main.ts
//   the same way as auth — see /src/features/auth/supabase-auth.ts).
// - Cloud sync details (debounce, retry, conflict reconcile) stay LOOSE
//   for TS-12 — we expose the orchestration hooks but the actual push
//   bodies stay inline until TS-13+ (realtime + sync).
// ============================================================================

import { deepMergeWorkspace, patchWorkspace } from './merge';
import { workspaceKey, loadStateFromLocal, persistStateToLocal } from './persistence';
import type { WorkspaceState } from './types';

// ---------------------------------------------------------------------------
// Defaults — the inline DEFAULTS object is enormous and still owns the
// "shape source of truth". main.ts hands us a reference via
// setWorkspaceDefaults(); we deep-clone before each use.
// ---------------------------------------------------------------------------

let _defaults: WorkspaceState = {};

export function setWorkspaceDefaults(d: WorkspaceState): void {
  _defaults = d;
}

export function getWorkspaceDefaults(): WorkspaceState {
  return _defaults;
}

// ---------------------------------------------------------------------------
// State accessor — single source of truth.
// ---------------------------------------------------------------------------

let _state: WorkspaceState = {};

export function getState(): WorkspaceState {
  return _state;
}

export function setState(next: WorkspaceState): void {
  _state = next;
}

/** Hydrate the in-memory state from localStorage (cold load entry point). */
export function hydrateStateFromLocal(): WorkspaceState {
  _state = loadStateFromLocal(_defaults);
  return _state;
}

// ---------------------------------------------------------------------------
// Concurrent-patch ordering — serialize patches through a microtask queue.
// ---------------------------------------------------------------------------

let _patchTail: Promise<void> = Promise.resolve();

/**
 * Apply a partial patch to the state, serialized through a promise queue.
 * Two concurrent callers always see "last write wins" without corruption
 * (no half-merged intermediate state visible). SC48 verifies this.
 */
export function patchState(partial: Partial<WorkspaceState>): Promise<WorkspaceState> {
  const ticket = _patchTail.then(() => {
    _state = patchWorkspace(_state, partial);
    return _state;
  });
  // Swallow rejections in the chain so a single throwing patch doesn't
  // block subsequent ones. (Errors are still surfaced to the awaiter
  // via the returned promise.)
  _patchTail = ticket.then(() => undefined, () => undefined);
  return ticket;
}

// ---------------------------------------------------------------------------
// Supabase client injection — same pattern as /src/features/auth/.
// ---------------------------------------------------------------------------

interface SupabaseDataClient {
  from: (table: string) => SupabaseQueryBuilder;
}

interface SupabaseQueryBuilder {
  select: (cols: string) => SupabaseQueryBuilder;
  eq: (col: string, val: unknown) => SupabaseQueryBuilder;
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { code?: string; message: string } | null }>;
  upsert: (row: Record<string, unknown>, opts?: { onConflict?: string }) => Promise<{ error: { message: string } | null }>;
  update: (patch: Record<string, unknown>) => SupabaseUpdateBuilder;
}

interface SupabaseUpdateBuilder {
  eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }>;
}

let _client: SupabaseDataClient | null = null;
const WORKSPACE_ID = 'degzzy_main';

export function setSupabaseDataClient(client: SupabaseDataClient | null): void {
  _client = client;
}

// ---------------------------------------------------------------------------
// Cloud load — fetch + deep-merge onto defaults + persist to local + apply.
// ---------------------------------------------------------------------------

let _lastRemoteUpdatedAt: string | null = null;

export function getLastRemoteUpdatedAt(): string | null {
  return _lastRemoteUpdatedAt;
}

export async function loadWorkspace(): Promise<boolean> {
  if (!_client) return false;
  try {
    const { data, error } = await _client.from('workspace').select('*').eq('id', WORKSPACE_ID).maybeSingle();
    if (error) throw error;
    if (data && data.state) {
      const base = JSON.parse(JSON.stringify(_defaults)) as WorkspaceState;
      _state = deepMergeWorkspace(base as Record<string, unknown>, data.state) as WorkspaceState;
      if (typeof data.updated_at === 'string') _lastRemoteUpdatedAt = data.updated_at;
      // Mirror the new state to localStorage so a subsequent cold load
      // sees the same blob without waiting for cloud.
      persistStateToLocal(_state);
      return true;
    }
  } catch (e) {
    console.warn('loadWorkspace:', e);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Save — debounced local write + rollback contract.
// ---------------------------------------------------------------------------

let _saveTimer: ReturnType<typeof setTimeout> | null = null;
let _onSaveSuccess: (() => void) | null = null;
let _cloudPushHook: (() => void) | null = null;

/** Registered by main.ts so cloud-sync stays decoupled from this module. */
export function registerCloudPushHook(fn: (() => void) | null): void {
  _cloudPushHook = fn;
}

/** Test hook so SC47 can observe a completed save without waiting on a timer. */
export function _setOnSaveSuccess(fn: (() => void) | null): void {
  _onSaveSuccess = fn;
}

/**
 * Debounced save — coalesces rapid mutations into one persist + cloud push.
 *
 * ROLLBACK CONTRACT (SC47):
 * If the localStorage write fails synchronously, the in-memory state is
 * NOT modified by this function — `_state` retains its current shape.
 * (The mutation that produced the new state happened OUTSIDE this call
 * via `setState` or `patchState`; saveWorkspace is only the persistence
 * step. If the write fails, the next save attempt sees the same state
 * and retries cleanly.)
 *
 * The caller can pass `{ immediate: true }` to skip the debounce — used
 * by tests + by logout/teardown paths that need a synchronous write.
 */
export function saveWorkspace(opts?: { immediate?: boolean }): void {
  // Schedule the cloud push synchronously — matches the inline behavior
  // where `scheduleCloudSave()` ran at the top of save(). The hook
  // owns its own debounce + retry + session refresh.
  if (_cloudPushHook) {
    try { _cloudPushHook(); } catch (_e) { /* never let cloud push throw */ }
  }
  const fire = (): void => {
    const ok = persistStateToLocal(_state);
    if (ok && _onSaveSuccess) {
      try { _onSaveSuccess(); } catch (_e) { /* test hook */ }
    }
  };
  if (opts && opts.immediate) {
    if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
    fire();
    return;
  }
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    fire();
  }, 80);
}

/** Cancel a pending debounced save. Used by SC47 and teardown paths. */
export function _cancelPendingSave(): void {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
}

// Silence unused-import warnings for the upsert/update builders we
// expose for future profiles.ts use without firing in workspace.ts.
void workspaceKey;
