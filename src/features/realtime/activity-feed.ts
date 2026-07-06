// ============================================================================
// Activity feed — ring buffer of recent activity events. Phase Realtime-1.
//
// Subscribes to the broadcast layer + maintains a bounded in-memory list
// of the most recent N events (default 50). Older events fall off the
// tail. The UI binds to this list to render a "recent activity" pane.
// ============================================================================

import type { ActivityEvent } from './types';
import { subscribeActivity } from './broadcast';

const DEFAULT_MAX = 50;

let _max = DEFAULT_MAX;
let _events: ActivityEvent[] = [];
let _unsubscribe: (() => boolean) | null = null;

type Sub = (events: ReadonlyArray<ActivityEvent>) => void;
const _subs = new Set<Sub>();

/** Start the feed. Idempotent. */
export function startActivityFeed(maxEvents: number = DEFAULT_MAX): void {
  _max = Math.max(1, maxEvents);
  if (_unsubscribe) return;
  _unsubscribe = subscribeActivity((event) => {
    _events = [event, ..._events].slice(0, _max);
    for (const fn of _subs) {
      try { fn(_events); } catch (e) { console.warn('[realtime/activity-feed] sub failed:', e); }
    }
  });
}

/** Stop the feed + release the broadcast subscription. Also clears the
 *  buffered events: the only non-test caller is logout teardown, and a
 *  residual buffer would leak the previous user's activity into the next
 *  session on a shared device. */
export function stopActivityFeed(): void {
  if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
  _events = [];
}

/** Read the current event list (most-recent-first). */
export function getActivityEvents(): ReadonlyArray<ActivityEvent> {
  return _events;
}

/** Subscribe to feed changes. Sync first-fire with current list. */
export function subscribeActivityFeed(fn: Sub): () => boolean {
  _subs.add(fn);
  try { fn(_events); } catch { /* ignore */ }
  return () => _subs.delete(fn);
}

/** Manually push an event (used to mirror locally-fired events). */
export function appendLocalActivity(event: ActivityEvent): void {
  _events = [event, ..._events].slice(0, _max);
  for (const fn of _subs) {
    try { fn(_events); } catch (e) { console.warn('[realtime/activity-feed] sub failed:', e); }
  }
}

// Test hooks ----------------------------------------------------------------
export function _resetActivityFeed(): void {
  stopActivityFeed();
  _events = [];
  _subs.clear();
  _max = DEFAULT_MAX;
}
export function _getFeedSize(): number { return _events.length; }
