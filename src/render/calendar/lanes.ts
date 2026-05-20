// ============================================================================
// Calendar render — lane assignment. Phase TS-13C.
//
// Given a set of overlapping timed events within a single day, assign
// each event to a "lane" (a column index) such that no two events in
// the same lane overlap in time. Used by week.ts to give overlapping
// events distinct horizontal positions.
//
// The inline week renderer currently does NOT do lane assignment — it
// stacks overlapping events directly on top of each other. This module
// prepares for the lane-aware rendering planned in a follow-up phase;
// for now week.ts can either consume it or stay on the flat layout.
// SC49 pins the lane-assignment determinism so a future opt-in stays safe.
//
// PURE — no DOM, no state.
// ============================================================================

import type { CalendarEvent } from './types';
import { timeToMins } from '../../lib/format-utils';

/** Assignment: event id → lane index (0-based). */
export type LaneAssignment = Map<string, number>;

/**
 * Compute lane indices for a list of events on the SAME day.
 *
 * Algorithm — greedy left-to-right:
 *   1. Sort events by start time ascending (untimed events come last).
 *   2. For each event, pick the lowest-index lane whose latest end is ≤
 *      this event's start.
 *   3. If no lane qualifies, allocate a new lane.
 *
 * Stable for identical inputs (SC52 pins this). Tie-breaks by id so the
 * order is deterministic across calls.
 */
export function assignLanes(events: CalendarEvent[]): LaneAssignment {
  const out: LaneAssignment = new Map();
  if (!Array.isArray(events) || events.length === 0) return out;

  // Build a sortable list of [event, start, end].
  const annotated = events.map((e) => {
    const startMins = e.time ? timeToMins(e.time) : null;
    const dur = parseInt(String(e.duration), 10) || 60;
    return {
      e,
      // Untimed events sit at +Infinity so they sort last (and never
      // collide with timed events in lane allocation).
      start: startMins == null ? Number.POSITIVE_INFINITY : startMins,
      end: startMins == null ? Number.POSITIVE_INFINITY : startMins + dur,
    };
  });

  annotated.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    // Tie-break by id so the output is deterministic for SC52.
    return a.e.id < b.e.id ? -1 : a.e.id > b.e.id ? 1 : 0;
  });

  // `laneEnds[i]` = the latest "end" time of any event currently in lane i.
  const laneEnds: number[] = [];

  for (const { e, start, end } of annotated) {
    // All-day / untimed events get their own lane each — they don't share.
    if (!isFinite(start)) {
      out.set(e.id, laneEnds.length);
      laneEnds.push(end);
      continue;
    }
    let assigned = -1;
    for (let i = 0; i < laneEnds.length; i++) {
      if (laneEnds[i] <= start) {
        assigned = i;
        break;
      }
    }
    if (assigned === -1) {
      assigned = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[assigned] = end;
    }
    out.set(e.id, assigned);
  }

  return out;
}

/** Total lane count needed for a set of events (= max assigned index + 1). */
export function laneCount(assignment: LaneAssignment): number {
  if (assignment.size === 0) return 0;
  let max = -1;
  for (const lane of assignment.values()) {
    if (lane > max) max = lane;
  }
  return max + 1;
}
