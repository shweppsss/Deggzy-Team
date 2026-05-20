// ============================================================================
// Queue — pure state machine. Phase TS-19.
//
// Today the queue is a single ordered list of trackIds with a cursor. The
// controller asks for the next or previous track at autoplay or skip time.
// Repeat/shuffle land later by mutating the cursor rule, not the data.
// ============================================================================

import type { QueueEntry } from './types';

let _queue: QueueEntry[] = [];
let _cursor = -1;

/** Replace the queue entirely. Cursor moves to the entry with `startId`
 *  (or -1 if not present). Idempotent. */
export function setQueue(ids: ReadonlyArray<string>, startId?: string): void {
  _queue = ids.map((id) => ({ trackId: id }));
  if (startId) {
    const idx = _queue.findIndex((e) => e.trackId === startId);
    _cursor = idx >= 0 ? idx : -1;
  } else {
    _cursor = _queue.length > 0 ? 0 : -1;
  }
}

/** Move the cursor to a specific track id. Returns true if present. */
export function setCursor(id: string): boolean {
  const idx = _queue.findIndex((e) => e.trackId === id);
  if (idx < 0) return false;
  _cursor = idx;
  return true;
}

/** Returns the trackId at the cursor (or null if queue is empty). */
export function currentTrackId(): string | null {
  if (_cursor < 0 || _cursor >= _queue.length) return null;
  return _queue[_cursor].trackId;
}

/** Returns the next trackId without moving the cursor (null if at tail). */
export function peekNext(): string | null {
  if (_cursor < 0 || _cursor + 1 >= _queue.length) return null;
  return _queue[_cursor + 1].trackId;
}

/** Returns the previous trackId without moving the cursor (null if at head). */
export function peekPrevious(): string | null {
  if (_cursor <= 0) return null;
  return _queue[_cursor - 1].trackId;
}

/** Advance the cursor and return the new track id (or null at tail). */
export function advance(): string | null {
  if (_cursor + 1 >= _queue.length) return null;
  _cursor++;
  return _queue[_cursor].trackId;
}

/** Move the cursor back and return the new track id (or null at head). */
export function retreat(): string | null {
  if (_cursor <= 0) return null;
  _cursor--;
  return _queue[_cursor].trackId;
}

/** Queue length. */
export function size(): number {
  return _queue.length;
}

/** Test hook: read internal cursor (read-only). */
export function _getCursor(): number {
  return _cursor;
}

/** Test hook: read the queue (read-only snapshot). */
export function _snapshot(): ReadonlyArray<QueueEntry> {
  return _queue.slice();
}

/** Test hook: reset state. */
export function _resetQueue(): void {
  _queue = [];
  _cursor = -1;
}
