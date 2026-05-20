// ============================================================================
// Calendar render — week view composition. Phase TS-13C.
//
// PURE STRING ASSEMBLY. No DOM, no state read, no side-effects.
//
// Inputs:
//   - weekStartIso       (Monday of the visible week)
//   - allEvents          (the raw event list — already filtered for the user)
//   - deps               (tooltip / tag chips / tag filter / visibility filter / avatar)
//   - opts               (gridStartHour, gridEndHour, hourHeight, todayIso)
//
// Returns:
//   - { html, headerLabel } so grid.ts can set both calendarGrid.innerHTML
//     AND the header text in one go.
// ============================================================================

import { toIsoDate, parseIsoDate } from '../shared/dates';
import { escapeHtml } from '../shared/badges';
import {
  expandEventsForWindow,
  detectEventConflicts,
} from './calculations';
import { weekChipGeometry, weekEventChipHTML } from './event-chip';
import type { CalendarEvent, CalendarDeps } from './types';

export interface WeekViewOpts {
  startHour: number;
  endHour: number;
  hourHeight: number;
  todayIso: string;
}

export interface WeekViewResult {
  html: string;
  headerLabel: string;
}

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** Compose the HTML for the week timeline view. */
export function buildWeekView(
  weekStartIso: string,
  allEvents: CalendarEvent[],
  deps: CalendarDeps,
  opts: WeekViewOpts,
): WeekViewResult {
  const monday = parseIsoDate(weekStartIso) || new Date();
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }

  const first = days[0];
  const last = days[6];
  const sameMonth = first.getMonth() === last.getMonth();
  const headerLabel = sameMonth
    ? first.getDate() + '–' + last.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : first.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) +
      ' – ' +
      last.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  const weekStartIsoLocal = toIsoDate(days[0]);
  const weekEndIso = toIsoDate(days[6]);
  const expandedWeek = expandEventsForWindow(allEvents, weekStartIsoLocal, weekEndIso);

  let html = '<div class="cal-week-gutter-head"></div>';

  // Day headers
  for (let i = 0; i < 7; i++) {
    const iso = toIsoDate(days[i]);
    html += `<div class="cal-week-head ${iso === opts.todayIso ? 'today' : ''}">
      ${DAY_NAMES[i]}
      <div class="cal-week-head-day">${days[i].getDate()}</div>
    </div>`;
  }

  // Hour gutter
  html += '<div class="cal-week-gutter">';
  for (let h = opts.startHour; h < opts.endHour; h++) {
    html += `<div class="cal-week-gutter-cell">${String(h).padStart(2, '0')}:00</div>`;
  }
  html += '</div>';

  // 7 day columns
  for (let i = 0; i < 7; i++) {
    const iso = toIsoDate(days[i]);
    const todayCls = iso === opts.todayIso ? 'today' : '';
    html += `<div class="cal-week-day ${todayCls}" data-date="${iso}">`;
    // Hour slots (background grid)
    for (let h = opts.startHour; h < opts.endHour; h++) {
      html += `<div class="cal-week-hour-slot" data-date="${iso}" data-hour="${h}"></div>`;
    }
    // Visible events for this day (post visibility + tag filter)
    const visibleAll = deps.filterVisibleEvents(expandedWeek);
    const dayEvents = visibleAll.filter((e) => e.date === iso);
    const conflicts = detectEventConflicts(dayEvents);
    for (const e of dayEvents) {
      if (!deps.entityMatchesTagFilter(e)) continue;
      const geom = weekChipGeometry(e, opts.startHour, opts.hourHeight);
      const conflictWith = conflicts.get(e.id);
      html += weekEventChipHTML(e, geom, conflictWith, deps);
    }
    // Current-time line on today
    if (iso === opts.todayIso) {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      if (nowMins >= opts.startHour * 60 && nowMins < opts.endHour * 60) {
        const offset = ((nowMins - opts.startHour * 60) / 60) * opts.hourHeight;
        html += `<div class="cal-week-now-line" style="top:${offset}px;"></div>`;
      }
    }
    html += '</div>';
  }

  return { html, headerLabel };
}

// `escapeHtml` is re-exported (via badges) so consumers don't have to
// chase the dependency through format-utils — the calendar module exposes
// its surface clean.
export { escapeHtml };
