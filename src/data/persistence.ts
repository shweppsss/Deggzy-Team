// ============================================================================
// Data layer — localStorage persistence. Phase TS-12.
//
// Owns:
//   - workspaceKey()              — derive the per-profile localStorage key
//   - loadStateFromLocal(defaults) — read + overlay onto defaults
//   - persistStateToLocal(state)  — synchronous write (no debounce)
//
// DESIGN RULES:
// - NO DOM, NO Supabase, NO `window.X` reads.
// - localStorage failures (Safari private mode, QuotaExceededError) are
//   caught and logged once — never thrown to the caller.
// - The debounce + cloud-sync side-effects of the inline `save()` are
//   NOT here — they belong to a future schedule layer. `save()` is a
//   workspace.ts concern.
// ============================================================================

import { deepMergeWorkspace } from './merge';
import type { WorkspaceState } from './types';

const LEGACY_LS_KEY = 'degzzy_workspace_v1';
const ACTIVE_PROFILE_KEY = 'degzzy_active_profile_v1';

function readActiveProfileId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PROFILE_KEY) || null;
  } catch (_e) {
    return null;
  }
}

/** Per-profile localStorage key. Falls back to the legacy key for unmigrated installs. */
export function workspaceKey(): string {
  const id = readActiveProfileId();
  return id ? `degzzy_workspace_${id}` : LEGACY_LS_KEY;
}

/**
 * Load workspace state from localStorage, overlaying on top of `defaults`.
 * If the row is missing / malformed / storage unavailable, returns a deep
 * clone of `defaults` (so the caller never gets a shared mutable reference).
 */
export function loadStateFromLocal(defaults: WorkspaceState): WorkspaceState {
  try {
    const raw = localStorage.getItem(workspaceKey());
    const base = JSON.parse(JSON.stringify(defaults)) as WorkspaceState;
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    return deepMergeWorkspace(base as Record<string, unknown>, parsed) as WorkspaceState;
  } catch (e) {
    console.warn('loadStateFromLocal fallback to defaults:', e);
    return JSON.parse(JSON.stringify(defaults)) as WorkspaceState;
  }
}

let _persistErrorLogged = false;

/**
 * Persist workspace state to localStorage. Synchronous, no debouncing.
 * (The legacy `save()` wraps this with a 220ms debounce + cloud-sync —
 *  that lives in workspace.ts.)
 *
 * Returns true on success, false on any storage error. Logs full
 * diagnostic detail once per session (size + LS total + key + error)
 * so the real failure cause is captured.
 */
export function persistStateToLocal(state: WorkspaceState): boolean {
  try {
    const payload = JSON.stringify(state);
    localStorage.setItem(workspaceKey(), payload);
    return true;
  } catch (e) {
    if (!_persistErrorLogged) {
      _persistErrorLogged = true;
      try {
        const sz = JSON.stringify(state).length;
        let lsTotal = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          const v = localStorage.getItem(k);
          lsTotal += (k.length + (v?.length || 0));
        }
        console.error('[Persistence] save failed:', { error: (e as Error).message, sizeBytes: sz, lsTotalChars: lsTotal, key: workspaceKey() });
      } catch (_e2) {
        console.error('[Persistence] save failed (diagnostics also failed):', e);
      }
    }
    return false;
  }
}

/** Remove the active workspace row — used by signOut / device reset paths. */
export function clearLocalWorkspace(): void {
  try { localStorage.removeItem(workspaceKey()); } catch (_e) { /* no-op */ }
}
