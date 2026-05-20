// ============================================================================
// Connectivity tracker. Phase Offline-1.
//
// Reads `navigator.onLine` once at boot, then listens for `online` /
// `offline` events on window. Exposes a tiny subscribe surface so other
// modules (queue, UI) can react to transitions.
//
// `navigator.onLine` is famously approximate — true doesn't mean the
// internet works, it means the OS reports a network interface. The cloud
// push itself catches network failures and surfaces them via the queue's
// `dirty` flag, so we use `onLine` only as a HINT (cheap, no fetch
// probe). Replay-on-reconnect uses the `online` event as the trigger.
// ============================================================================

import type { ConnectivityStatus, OfflineDeps } from './types';

let _deps: OfflineDeps | null = null;
let _status: ConnectivityStatus = 'online';
type Subscriber = (s: ConnectivityStatus) => void;
const _subs = new Set<Subscriber>();

export function registerConnectivityDeps(deps: OfflineDeps): void {
  _deps = deps;
  // Initial read.
  _status = (deps.isNavigatorOnline ? deps.isNavigatorOnline() : (typeof navigator !== 'undefined' && navigator.onLine !== false)) ? 'online' : 'offline';
  _attachWindowListeners();
}

export function getConnectivity(): ConnectivityStatus {
  return _status;
}

export function isOnline(): boolean {
  return _status === 'online';
}

export function subscribeConnectivity(fn: Subscriber): () => boolean {
  _subs.add(fn);
  // Sync first-fire so subscribers see the current state.
  try { fn(_status); } catch { /* subscriber error must not break siblings */ }
  return () => _subs.delete(fn);
}

function _emit(): void {
  for (const fn of _subs) {
    try { fn(_status); } catch (e) { console.warn('[offline] subscriber failed:', e); }
  }
}

function _setStatus(next: ConnectivityStatus): void {
  if (next === _status) return;
  _status = next;
  _emit();
}

function _attachWindowListeners(): void {
  if (!_deps) return;
  const onOnline = (): void => _setStatus('online');
  const onOffline = (): void => _setStatus('offline');
  const addL = _deps.addConnectivityListener
    || ((type, fn) => { if (typeof window !== 'undefined') window.addEventListener(type, fn); });
  addL('online', onOnline);
  addL('offline', onOffline);
}

// Test hooks ----------------------------------------------------------------
export function _forceStatus(next: ConnectivityStatus): void {
  _setStatus(next);
}
export function _getSubscriberCount(): number { return _subs.size; }
export function _resetConnectivity(): void {
  _subs.clear();
  _status = 'online';
  _deps = null;
}
