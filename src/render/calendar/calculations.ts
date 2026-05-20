// ============================================================================
// Calendar render — calculations. Phase TS-13C.
//
// PURE math + data-shape helpers:
//   - eventsOverlap(a, b)              → boolean (timed events only)
//   - detectEventConflicts(events)     → Map<id, CalendarEvent[]>
//   - expandMultiDay(ev)               → CalendarEvent[]
//   - expandRecurrence(ev, ws, we)     → CalendarEvent[]
//   - expandEventsForWindow(...)       → CalendarEvent[]
//   - stepRecurrence(iso, freq)        → string | null
//
// NO DOM, NO window, NO state. Deterministic — same input → same output.
//
// `OVERLOAD_THRESHOLD` and `RECURRENCE_HORIZON_DAYS` are also exported so
// week.ts / month.ts can reference them without duplicating literals.
// ============================================================================

import { addDays, isoMin, parseIsoDate, toIsoDate } from '../shared/dates';
import type { CalendarEvent, ConflictsMap } from './types';
import { timeToMins } from '../../lib/format-utils';

/** Day is considered overloaded above this count of visible events. */
export const OVERLOAD_THRESHOLD = 5;

/** Hard cap for recurrence expansion so a "daily, no until" can't explode. */
export const RECURRENCE_HORIZON_DAYS = 730;

/**
 * Two timed events on the same day overlap when their [start, end) intervals
 * intersect. All-day (no time) entries never count as a conflict — they share
 * the day with everything else by design.
 */
export function eventsOverlap(a: CalendarEvent | null | undefined, b: CalendarEvent | null | undefined): boolean {
  if (!a || !b || a.date !== b.date) return false;
  if (!a.time || !b.time) return false;
  const aStart = timeToMins(a.time);
  const bStart = timeToMins(b.time);
  if (aStart == null || bStart == null) return false;
  const aEnd = aStart + (parseInt(String(a.duration), 10) || 60);
  const bEnd = bStart + (parseInt(String(b.duration), 10) || 60);
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Returns a Map<eventId, Array<conflictingEvent>> for events that overlap
 * with at least one other event on the same day. O(n²) per-day — fine at
 * the per-week / per-month scale this renderer operates at.
 */
export function detectEventConflicts(events: CalendarEvent[]): ConflictsMap {
  const conflicts: ConflictsMap = new Map();
  const byDate: Record<string, CalendarEvent[]> = {};
  for (const e of events) {
    if (!e || !e.date) continue;
    (byDate[e.date] = byDate[e.date] || []).push(e);
  }
  for (const date in byDate) {
    const day = byDate[date];
    for (let i = 0; i < day.length; i++) {
      for (let j = i + 1; j < day.length; j++) {
        if (eventsOverlap(day[i], day[j])) {
          if (!conflicts.has(day[i].id)) conflicts.set(day[i].id, []);
          if (!conflicts.has(day[j].id)) conflicts.set(day[j].id, []);
          conflicts.get(day[i].id)!.push(day[j]);
          conflicts.get(day[j].id)!.push(day[i]);
        }
      }
    }
  }
  return conflicts;
}

// ---------------------------------------------------------------------------
// Multi-day expansion
// ---------------------------------------------------------------------------

/**
 * Generates one virtual event per day for a multi-day span. Single-day
 * events return as-is (no flags added). Virtual instances mirror the
 * parent's fields 1:1 except `date`, and gain `_spanIndex` / `_spanTotal`
 * for renderer hints.
 */
export function expandMultiDay(ev: CalendarEvent): CalendarEvent[] {
  if (!ev || !ev.endDate || (ev.date && ev.endDate <= ev.date)) return ev ? [ev] : [];
  if (!ev.date) return [ev];
  const span = diffDaysInternal(ev.date, ev.endDate) + 1;
  if (span <= 1) return [ev];
  const out: CalendarEvent[] = [];
  for (let i = 0; i < span; i++) {
    const day = addDays(ev.date, i);
    out.push({
      ...ev,
      date: day,
      _isVirtual: true,
      _spanIndex: i,
      _spanTotal: span,
    });
  }
  return out;
}

/** diffDays equivalent — kept local so calculations.ts has no off-module date math. */
function diffDaysInternal(aIso: string, bIso: string): number {
  const a = parseIsoDate(aIso);
  const b = parseIsoDate(bIso);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Steps a date forward by one recurrence tick. Returns null on unknown freq.
 */
export function stepRecurrence(iso: string, freq: string | undefined): string | null {
  const d = parseIsoDate(iso);
  if (!d) return null;
  if (freq === 'daily') d.setDate(d.getDate() + 1);
  else if (freq === 'weekly') d.setDate(d.getDate() + 7);
  else if (freq === 'monthly') d.setMonth(d.getMonth() + 1);
  else return null;
  return toIsoDate(d);
}

/**
 * Generates the set of occurrences inside [windowStart, windowEnd]. Each
 * occurrence is itself passed through expandMultiDay so a recurring 3-day
 * shoot expands into [N occurrences] × [3 days]. Non-recurring events
 * return their multi-day expansion (still a no-op for the single-day case).
 */
export function expandRecurrence(ev: CalendarEvent, windowStart: string, windowEnd: string): CalendarEvent[] {
  if (!ev) return [];
  const rec = ev.recurrence;
  if (!rec || !rec.freq || rec.freq === 'none') return expandMultiDay(ev);
  if (!ev.date) return [];
  const horizonEnd = addDays(ev.date, RECURRENCE_HORIZON_DAYS);
  const lastAllowed = isoMin(windowEnd, isoMin(rec.until || horizonEnd, horizonEnd));
  const occurrences: CalendarEvent[] = [];
  let cur: string | null = ev.date;
  let safety = 0;
  while (cur && cur <= lastAllowed && safety++ < 2000) {
    const occ: CalendarEvent = { ...ev, date: cur, _isRecurring: true };
    const expanded = expandMultiDay(occ);
    for (const v of expanded) {
      if (v.date && v.date >= windowStart && v.date <= windowEnd) occurrences.push(v);
    }
    cur = stepRecurrence(cur, rec.freq);
  }
  return occurrences;
}

/**
 * Flattens an event list into renderable per-day virtual instances within
 * [windowStart, windowEnd]. Used by both month and week renderers.
 */
export function expandEventsForWindow(
  events: CalendarEvent[] | null | undefined,
  windowStart: string,
  windowEnd: string,
): CalendarEvent[] {
  if (!Array.isArray(events)) return [];
  const out: CalendarEvent[] = [];
  for (const ev of events) {
    if (!ev || !ev.date) continue;
    const rec = ev.recurrence;
    if (rec && rec.freq && rec.freq !== 'none') {
      const expanded = expandRecurrence(ev, windowStart, windowEnd);
      for (const v of expanded) out.push(v);
    } else if (ev.endDate && ev.endDate > ev.date) {
      const expanded = expandMultiDay(ev);
      for (const v of expanded) {
        if (v.date && v.date >= windowStart && v.date <= windowEnd) out.push(v);
      }
    } else {
      if (ev.date >= windowStart && ev.date <= windowEnd) out.push(ev);
    }
  }
  return out;
}
