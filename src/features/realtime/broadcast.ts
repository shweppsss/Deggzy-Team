// ============================================================================
// Broadcast — fires + receives activity events over Supabase realtime.
// Phase Realtime-1.
//
// Channel name: 'activity:degzzy_main'. We send events via the channel's
// broadcast surface and receive them via .on('broadcast', { event: 'activity' },
// handler). The receiver handler dispatches to all subscribers + appends
// to the in-memory activity feed (see activity-feed.ts).
//
// Idempotency: each event has a session-unique id. The receiver checks
// the id against a tiny LRU so a duplicate delivery (Supabase can replay
// on reconnect) doesn't double-fire subscribers.
// ============================================================================

import type { ActivityEvent, ActivityEventKind, PresenceUser, RealtimeChannel, RealtimeDeps } from './types';

const ACTIVITY_CHANNEL_NAME = 'activity:degzzy_main';
const SEEN_LRU_MAX = 200;

let _deps: RealtimeDeps | null = null;
let _channel: RealtimeChannel | null = null;
let _eventCounter = 0;
const _seen = new Set<string>();
const _seenOrder: string[] = [];

type Sub = (event: ActivityEvent) => void;
const _subs = new Set<Sub>();

export function registerBroadcastDeps(deps: RealtimeDeps): void {
  _deps = deps;
  if (_channel) {
    try { _channel.unsubscribe(); } catch { /* ignore */ }
    _channel = null;
  }
  _channel = deps.createChannel(ACTIVITY_CHANNEL_NAME);
  _channel.on('broadcast', { event: 'activity' }, (raw) => {
    const payload = (raw as { payload?: ActivityEvent }).payload;
    if (!payload || typeof payload !== 'object') return;
    _ingest(payload as ActivityEvent);
  });
  _channel.subscribe();
}

/** Stop listening + close the channel. Used by teardown + tests. */
export function stopBroadcast(): void {
  if (_channel) {
    try { _channel.unsubscribe(); } catch { /* ignore */ }
    _channel = null;
  }
}

/** Subscribe to ALL received activity events. */
export function subscribeActivity(fn: Sub): () => boolean {
  _subs.add(fn);
  return () => _subs.delete(fn);
}

/**
 * Broadcast an activity event to all other clients on the channel.
 * Stamps the event with the current actor, monotonic id, and timestamp.
 * Returns the event (with id) so callers can mirror it locally if needed.
 */
export function broadcastActivity(
  kind: ActivityEventKind,
  summary: string,
  entityId?: string,
): ActivityEvent | null {
  if (!_deps) return null;
  const actor = _deps.getActor();
  if (!actor) return null;
  const event: ActivityEvent = {
    id: actor.id + ':' + (++_eventCounter) + ':' + Date.now(),
    kind,
    actor,
    entityId,
    summary,
    at: new Date().toISOString(),
  };
  // Self-mark seen so the round-trip from Supabase doesn't double-fire.
  _markSeen(event.id);
  if (_channel) {
    try {
      _channel.send({ type: 'broadcast', event: 'activity', payload: event });
    } catch (e) {
      console.warn('[realtime/broadcast] send failed:', e);
    }
  }
  return event;
}

function _ingest(event: ActivityEvent): void {
  if (!event.id) return;
  if (_seen.has(event.id)) return;
  _markSeen(event.id);
  for (const fn of _subs) {
    try { fn(event); } catch (e) { console.warn('[realtime/broadcast] sub failed:', e); }
  }
}

function _markSeen(id: string): void {
  _seen.add(id);
  _seenOrder.push(id);
  while (_seenOrder.length > SEEN_LRU_MAX) {
    const drop = _seenOrder.shift();
    if (drop) _seen.delete(drop);
  }
}

// Test hooks ----------------------------------------------------------------
export function _injectRemoteEvent(event: ActivityEvent): void { _ingest(event); }
export function _getSeenCount(): number { return _seen.size; }
export function _getChannel(): RealtimeChannel | null { return _channel; }
export function _resetBroadcast(): void {
  stopBroadcast();
  _subs.clear();
  _seen.clear();
  _seenOrder.length = 0;
  _eventCounter = 0;
  _deps = null;
}
