// ============================================================================
// Presence — read-only view over the existing inline presence channel.
// Phase Realtime-1.
//
// The inline code already maintains a presence map (channel
// 'presence:degzzy_main'). We don't re-join — we read via deps.getPresenceMap
// and expose a typed subscribe API + a few derived helpers (count, list).
// Subscribers re-fire whenever pollPresence() detects a change.
// ============================================================================

import type { PresenceUser, RealtimeDeps } from './types';

let _deps: RealtimeDeps | null = null;
let _cache: ReadonlyArray<PresenceUser> = [];
type Sub = (users: ReadonlyArray<PresenceUser>) => void;
const _subs = new Set<Sub>();
let _pollTimer: ReturnType<typeof setInterval> | null = null;

export function registerPresenceDeps(deps: RealtimeDeps): void {
  _deps = deps;
  _refresh();
  // Lightweight poll on a 2-second cadence. The inline channel fires sync
  // events into the host's state but doesn't expose a subscribe; polling
  // is cheap (deps.getPresenceMap is an in-memory read).
  if (_pollTimer == null && typeof setInterval !== 'undefined') {
    _pollTimer = setInterval(() => _refresh(), 2000);
  }
}

/** Stop polling. Used by teardown + tests. */
export function stopPresencePolling(): void {
  if (_pollTimer != null) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
}

export function getOnlineUsers(): ReadonlyArray<PresenceUser> {
  return _cache;
}

export function getOnlineCount(): number {
  return _cache.length;
}

export function subscribePresence(fn: Sub): () => boolean {
  _subs.add(fn);
  try { fn(_cache); } catch { /* ignore */ }
  return () => _subs.delete(fn);
}

function _refresh(): void {
  if (!_deps) return;
  const getter = _deps.getPresenceMap;
  if (!getter) return;
  const map = getter();
  const next: PresenceUser[] = [];
  if (map) {
    for (const id of Object.keys(map)) {
      const u = map[id];
      if (u) next.push(u);
    }
  }
  // Diff: only emit if the user-id set or names changed.
  const prevKey = _cache.map((u) => u.id + ':' + u.name).sort().join('|');
  const nextKey = next.map((u) => u.id + ':' + u.name).sort().join('|');
  if (prevKey === nextKey) return;
  _cache = next;
  for (const fn of _subs) {
    try { fn(_cache); } catch (e) { console.warn('[realtime/presence] sub failed:', e); }
  }
}

// Test hooks ----------------------------------------------------------------
export function _forceRefresh(): void { _refresh(); }
export function _resetPresence(): void {
  stopPresencePolling();
  _subs.clear();
  _cache = [];
  _deps = null;
}
