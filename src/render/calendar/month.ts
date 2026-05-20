// ============================================================================
// Calendar render — month view composition. Phase TS-13C.
//
// PURE STRING ASSEMBLY. No DOM, no state read, no side-effects.
//
// Inputs:
//   - calMonth   ('YYYY-MM' string from state.calMonth)
//   - allEvents  (raw event list)
//   - deps       (tooltip / tag chips / filters / avatar)
//   - opts       (todayIso, overloadThreshold)
//
// Returns:
//   - { html, headerLabel } for grid.ts to mount.
// ============================================================================

import {
  expandEventsForWindow,
  detectEventConflicts,
  OVERLOAD_THRESHOLD,
} from './calculations';
import { monthEventChipHTML } from './event-chip';
import { overloadBadgeHTML } from '../shared/badges';
import type { CalendarEvent, CalendarDeps } from './types';

export interface MonthViewOpts {
  todayIso: string;
}

export interface MonthViewResult {
  html: string;
  headerLabel: string;
}

const HEAD_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** Compose the HTML for the month grid view. */
export function buildMonthView(
  calMonth: string,
  allEvents: CalendarEvent[],
  deps: CalendarDeps,
  opts: MonthViewOpts,
): MonthViewResult {
  const [year, month] = calMonth.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const startWeek = (first.getDay() + 6) % 7; // start Monday
  const daysInMonth = last.getDate();
  const prevDays = new Date(year, month - 1, 0).getDate();

  const headerLabel = first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  let html = HEAD_LABELS.map((h) => `<div class="cal-head">${h}</div>`).join('');

  // Pre-expand events for the visible month window.
  const monthStartIso = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEndIso = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
  const expandedMonth = expandEventsForWindow(allEvents, monthStartIso, monthEndIso);

  // Today midnight (for the .today cell flag)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Prev-month tail (greyed days from the previous month).
  for (let i = startWeek - 1; i >= 0; i--) {
    const d = prevDays - i;
    html += `<div class="cal-cell muted"><div class="cal-day">${d}</div></div>`;
  }

  // Current month cells
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = date.getTime() === today.getTime();
    const dayEvents = deps.filterVisibleEvents(expandedMonth).filter((e) => e.date === iso);
    const conflicts = detectEventConflicts(dayEvents);
    const visibleEvents = dayEvents.filter(deps.entityMatchesTagFilter);
    const isOverloaded = visibleEvents.length > OVERLOAD_THRESHOLD;
    const overload = isOverloaded ? overloadBadgeHTML(visibleEvents.length) : '';
    // Sort by time ascending; untimed sit last via '99:99' sentinel.
    const sorted = visibleEvents.slice().sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    const eventsHtml = sorted.map((e) => monthEventChipHTML(e, conflicts.get(e.id), deps)).join('');
    html += `
      <div class="cal-cell ${isToday ? 'today' : ''}${isOverloaded ? ' overload' : ''}" data-date="${iso}">
        <div class="cal-day">${day}</div>
        ${overload}
        ${eventsHtml}
      </div>
    `;
  }

  // Next-month tail to fill the last week row to 7 days.
  const filled = startWeek + daysInMonth;
  const tail = (7 - (filled % 7)) % 7;
  for (let i = 1; i <= tail; i++) {
    html += `<div class="cal-cell muted"><div class="cal-day">${i}</div></div>`;
  }

  return { html, headerLabel };
}

// Re-export the threshold so callers can reason about overload boundaries.
export { OVERLOAD_THRESHOLD };
