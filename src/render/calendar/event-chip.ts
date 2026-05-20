// ============================================================================
// Calendar render — event chip HTML. Phase TS-13C.
//
// Pure HTML composition for the two chip shapes the calendar renders:
//   - weekEventChipHTML(...)  → positioned block in the week timeline
//   - monthEventChipHTML(...) → inline pill in a month grid cell
//
// Both take (entity, deps, ctx) and return a string. No DOM, no state.
// ============================================================================

import { escapeHtml, formatEventTime, formatDuration, formatEventRange, timeToMins } from '../../lib/format-utils';
import { conflictTooltip, spanClass, spanTooltip, joinTooltips } from '../shared/badges';
import type { CalendarEvent, CalendarDeps } from './types';

/** Computed geometry for a week-view event block. */
export interface WeekChipGeometry {
  /** Top offset in px (relative to the day column origin). */
  top: number;
  /** Block height in px. */
  height: number;
  /** Time label to show in the chip ('' for all-day → "Toute la journée"). */
  timeLabel: string;
  /** True when the event has no time → renders as an all-day pill at the top. */
  allDay: boolean;
}

/**
 * Pure geometry calculator for a week event chip. Given the event's
 * time/duration + the week grid's start hour / hour height, returns
 * the positioning data. Caller composes the HTML with this geometry.
 */
export function weekChipGeometry(
  e: CalendarEvent,
  startHour: number,
  hourHeight: number,
): WeekChipGeometry {
  let mins = e.time ? timeToMins(e.time) : null;
  let allDay = false;
  if (mins === null) {
    mins = startHour * 60;
    allDay = true;
  }
  const minutesFromTop = Math.max(0, mins - startHour * 60);
  const top = (minutesFromTop / 60) * hourHeight;
  // All-day events use a visual 1h slot; timed events use their duration.
  const heightMins = allDay ? 60 : Math.max(15, parseInt(String(e.duration), 10) || 60);
  const height = (heightMins / 60) * hourHeight - 4;
  const timeLabel = allDay
    ? 'Toute la journée'
    : (e.time ? formatEventRange(e.time, heightMins) : '');
  return { top, height, timeLabel, allDay };
}

/**
 * Render an event chip for the week timeline view. Pure: takes the
 * pre-computed geometry + the conflict-with list + deps. Returns string.
 */
export function weekEventChipHTML(
  e: CalendarEvent,
  geom: WeekChipGeometry,
  conflictWith: CalendarEvent[] | undefined,
  deps: CalendarDeps,
): string {
  const baseTip = deps.eventTooltip(e);
  const cTip = conflictTooltip(conflictWith || []);
  const sTip = spanTooltip(e._spanIndex, e._spanTotal);
  const tip = joinTooltips(baseTip, cTip, sTip);
  const conflictCls = conflictWith && conflictWith.length ? ' conflict' : '';
  const recurringCls = e._isRecurring ? ' is-recurring' : '';
  const sCls = spanClass(e._spanIndex, e._spanTotal);
  const avatar = e.createdBy ? deps.eventActorAvatarHTML(e.createdBy) : '';
  // Resize handle hidden for all-day pills and on mid/end span days.
  const resizeHandle = (geom.allDay || sCls)
    ? ''
    : '<div class="cal-week-event-resize" data-resize-handle="1"></div>';
  return `<div class="cal-week-event${conflictCls}${recurringCls}${sCls}" data-type="${escapeHtml(e.type)}" data-visibility="${e.visibility === 'private' ? 'private' : 'team'}" data-event-id="${escapeHtml(e.id)}"
                  style="top:${geom.top + 2}px; height:${geom.height}px;"${tip ? ` title="${escapeHtml(tip)}"` : ''}>
    ${avatar ? `<div class="cal-week-event-actor">${avatar}</div>` : ''}
    ${geom.timeLabel ? `<div class="cal-week-event-time">${geom.timeLabel}</div>` : ''}
    <div class="cal-week-event-title">${escapeHtml(e.title)}</div>
    ${resizeHandle}
  </div>`;
}

/**
 * Render an event pill for the month grid cell. Pure HTML composition.
 */
export function monthEventChipHTML(
  e: CalendarEvent,
  conflictWith: CalendarEvent[] | undefined,
  deps: CalendarDeps,
): string {
  const baseTip = deps.eventTooltip(e);
  const cTip = conflictTooltip(conflictWith || []);
  const sTip = spanTooltip(e._spanIndex, e._spanTotal);
  const tip = joinTooltips(baseTip, cTip, sTip);
  const conflictCls = conflictWith && conflictWith.length ? ' conflict' : '';
  const recurringCls = e._isRecurring ? ' is-recurring' : '';
  const sCls = spanClass(e._spanIndex, e._spanTotal);
  const isContinuation = sCls && !sCls.includes('start');
  const avatar = e.createdBy ? deps.eventActorAvatarHTML(e.createdBy) : '';
  // Show duration suffix only when it's not the default 1h.
  const dur = parseInt(String(e.duration), 10);
  const durSuffix = (e.time && dur && dur !== 60 && !isContinuation)
    ? ` <span class="cal-event-dur">(${formatDuration(dur)})</span>`
    : '';
  const tagHtml = (Array.isArray(e.tags) && e.tags.length) ? ' ' + deps.tagChipsHTML(e.tags, { limit: 1 }) : '';
  const timeHtml = (e.time && !isContinuation)
    ? `<strong>${formatEventTime(e.time)}</strong>${durSuffix} `
    : '';
  const titlePrefix = isContinuation ? '▸ ' : '';
  return `<div class="cal-event${conflictCls}${recurringCls}${sCls}" data-type="${escapeHtml(e.type)}" data-visibility="${e.visibility === 'private' ? 'private' : 'team'}" data-event-id="${escapeHtml(e.id)}"${tip ? ` title="${escapeHtml(tip)}"` : ''}>${avatar}${timeHtml}${titlePrefix}${escapeHtml(e.title)}${tagHtml}</div>`;
}
