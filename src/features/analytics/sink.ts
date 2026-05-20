// ============================================================================
// Event sink — bounded ring buffer + optional forwarder. Phase Analytics-1.
//
// Every event flows through `track(category, action, meta?, value?)`. It:
//   1. Stamps id + timestamp
//   2. Appends to a bounded buffer (oldest evicted on overflow)
//   3. Forwards to deps.send if registered
//
// The buffer is queryable from devtools (window.getAnalytics()) — handy
// for debugging without setting up a real backend.
// ============================================================================

import type { AnalyticsDeps, AnalyticsEvent, AnalyticsEventCategory } from './types';

const DEFAULT_BUFFER_SIZE = 500;

let _deps: AnalyticsDeps | null = null;
let _bufferSize = DEFAULT_BUFFER_SIZE;
let _events: AnalyticsEvent[] = [];
let _counter = 0;
let _enabled = true;

export function registerAnalyticsDeps(deps: AnalyticsDeps): void {
  _deps = deps;
  if (typeof deps.bufferSize === 'number' && deps.bufferSize > 0) {
    _bufferSize = Math.floor(deps.bufferSize);
  }
}

/** Master switch — used by tests and by future privacy preferences. */
export function setAnalyticsEnabled(enabled: boolean): void {
  _enabled = !!enabled;
}

export function isAnalyticsEnabled(): boolean {
  return _enabled;
}

/**
 * Record an event. Most-recent at the END of the buffer (we slice the head
 * on overflow so the cost is amortized O(1) for typical usage patterns).
 */
export function track(
  category: AnalyticsEventCategory,
  action: string,
  meta?: Record<string, unknown>,
  value?: number,
): AnalyticsEvent | null {
  if (!_enabled) return null;
  const event: AnalyticsEvent = {
    category,
    action,
    value,
    meta,
    id: ++_counter,
    at: new Date().toISOString(),
  };
  _events.push(event);
  if (_events.length > _bufferSize) {
    // Evict from the head (oldest).
    _events = _events.slice(_events.length - _bufferSize);
  }
  if (_deps && _deps.send) {
    try { _deps.send(event); } catch (e) { console.warn('[analytics] send failed:', e); }
  }
  return event;
}

/** Read recent events (oldest-first). Optional filter by category. */
export function getRecentEvents(category?: AnalyticsEventCategory): ReadonlyArray<AnalyticsEvent> {
  if (!category) return _events.slice();
  return _events.filter((e) => e.category === category);
}

/** Count events by (category, action). Useful for dashboards + tests. */
export function countEvents(category?: AnalyticsEventCategory, action?: string): number {
  if (!category && !action) return _events.length;
  return _events.filter((e) =>
    (!category || e.category === category) && (!action || e.action === action),
  ).length;
}

/** Clear the buffer. Used by tests + opt-out flows. */
export function clearEvents(): void {
  _events = [];
}

// Test hooks ----------------------------------------------------------------
export function _resetAnalytics(): void {
  _events = [];
  _counter = 0;
  _enabled = true;
  _bufferSize = DEFAULT_BUFFER_SIZE;
  _deps = null;
}
export function _getBufferSize(): number { return _bufferSize; }
