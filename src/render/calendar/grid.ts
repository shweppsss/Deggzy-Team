// ============================================================================
// Calendar render — DOM mounting. Phase TS-13C.
//
// The ONLY file in /src/render/calendar/ that talks to the DOM directly.
// Reads state via the data layer (window.state), composes HTML via
// week.ts / month.ts, writes it to #calendarGrid, then re-attaches the
// inline drag handlers via the host hook.
//
// PUBLIC API:
//   - renderCalendarView(deps, interactionHooks)
//   - registerCalendarInteractionHooks(hooks)
//
// Side-effects:
//   - sweeps drag ghosts (transient leftover from any interrupted drag)
//   - sets `#calendarGrid.className` ('cal-week' or 'calendar-grid')
//   - sets `#calendarGrid.innerHTML`
//   - sets `#calMonth.textContent`
//   - calls the registered interaction hook (attach pointer listeners)
//   - calls upgradeEventAvatars / renderTagsBar via host hooks
// ============================================================================

import { getState } from '../../data';
import { toIsoDate, parseIsoDate, getMondayOf } from '../shared/dates';
import { buildWeekView, type WeekViewOpts } from './week';
import { buildMonthView, type MonthViewOpts } from './month';
import { sweepDragGhosts } from './drag-preview';
import type { CalendarEvent, CalendarDeps } from './types';

// ---------------------------------------------------------------------------
// Interaction hooks — registered by main.ts. These are the inline-defined
// drag-handler attach functions; calendar/grid.ts calls them after each
// render so pills are interactive again.
// ---------------------------------------------------------------------------

export interface CalendarInteractionHooks {
  /** Attach week-view drag + resize handlers to the freshly-rendered pills. */
  attachWeekInteractions?: () => void;
  /** Attach month-view drag handlers to the freshly-rendered pills. */
  attachMonthInteractions?: () => void;
  /** Optional: refresh actor-avatar IDB photos (async). */
  upgradeEventAvatars?: () => Promise<void> | void;
  /** Optional: redraw the tags bar above the calendar. */
  renderTagsBar?: () => void;
}

let _hooks: CalendarInteractionHooks = {};

export function registerCalendarInteractionHooks(hooks: CalendarInteractionHooks): void {
  _hooks = { ..._hooks, ...hooks };
}

// ---------------------------------------------------------------------------
// View constants — kept here so they're visible to anyone reading grid.ts.
// ---------------------------------------------------------------------------

const WEEK_START_HOUR = 7;   // matches CSS --week-start-h
const WEEK_END_HOUR = 23;    // exclusive
const WEEK_HOUR_HEIGHT = 56; // px — matches CSS --week-hour-h

interface RenderableState {
  events?: CalendarEvent[];
  calView?: string;
  calMonth?: string;
  calWeekStart?: string;
}

/**
 * Render the calendar — month or week depending on state.calView. This is
 * the function that replaces the inline `renderCalendar()`.
 *
 * `deps` is the calendar render-deps snapshot (tooltip, tag chips, filters,
 * avatar) — main.ts builds it from the legacy inline helpers.
 */
export function renderCalendarView(deps: CalendarDeps): void {
  const grid = document.getElementById('calendarGrid');
  if (!grid) return;

  const state = getState() as RenderableState;
  const todayIso = toIsoDate(new Date());

  // Orphan sweep — if a drag was interrupted by a mid-drag re-render (e.g.
  // a realtime sync arrived while the user was dragging), the floating
  // ghost survives the innerHTML replace and stays stuck on screen.
  // Wipe any leftover here before drawing. SC50 pins this contract.
  sweepDragGhosts();

  // Sync the month/week toggle to current state.
  const monthTab = document.getElementById('calViewMonth');
  const weekTab = document.getElementById('calViewWeek');
  if (monthTab && weekTab) {
    monthTab.classList.toggle('active', state.calView !== 'week');
    weekTab.classList.toggle('active', state.calView === 'week');
  }

  if (state.calView === 'week') {
    renderWeekViewInternal(grid, state, deps, todayIso);
  } else {
    renderMonthViewInternal(grid, state, deps, todayIso);
  }
}

function renderWeekViewInternal(grid: HTMLElement, state: RenderableState, deps: CalendarDeps, todayIso: string): void {
  grid.className = 'cal-week';
  grid.style.gridTemplateColumns = '';
  // Resolve current Monday
  const weekStartIso = state.calWeekStart || toIsoDate(getMondayOf(new Date()));
  const opts: WeekViewOpts = {
    startHour: WEEK_START_HOUR,
    endHour: WEEK_END_HOUR,
    hourHeight: WEEK_HOUR_HEIGHT,
    todayIso,
  };
  const { html, headerLabel } = buildWeekView(weekStartIso, state.events || [], deps, opts);
  // Header label
  const headerEl = document.getElementById('calMonth');
  if (headerEl) headerEl.textContent = headerLabel;
  // Mount
  grid.innerHTML = html;
  // Re-attach interactions for the new pills.
  if (_hooks.attachWeekInteractions) {
    try { _hooks.attachWeekInteractions(); } catch (e) { console.error('attachWeekInteractions:', e); }
  }
  if (_hooks.upgradeEventAvatars) {
    try { Promise.resolve(_hooks.upgradeEventAvatars()).catch(() => {}); } catch (_e) { /* no-op */ }
  }
  if (_hooks.renderTagsBar) {
    try { _hooks.renderTagsBar(); } catch (_e) { /* no-op */ }
  }
  // Silence unused import (helps if a future refactor needs parseIsoDate elsewhere).
  void parseIsoDate;
}

function renderMonthViewInternal(grid: HTMLElement, state: RenderableState, deps: CalendarDeps, todayIso: string): void {
  grid.className = 'calendar-grid';
  const opts: MonthViewOpts = { todayIso };
  const calMonth = state.calMonth || '';
  if (!calMonth) return;
  const { html, headerLabel } = buildMonthView(calMonth, state.events || [], deps, opts);
  const headerEl = document.getElementById('calMonth');
  if (headerEl) headerEl.textContent = headerLabel;
  grid.innerHTML = html;
  if (_hooks.attachMonthInteractions) {
    try { _hooks.attachMonthInteractions(); } catch (e) { console.error('attachMonthInteractions:', e); }
  }
  if (_hooks.upgradeEventAvatars) {
    try { Promise.resolve(_hooks.upgradeEventAvatars()).catch(() => {}); } catch (_e) { /* no-op */ }
  }
  if (_hooks.renderTagsBar) {
    try { _hooks.renderTagsBar(); } catch (_e) { /* no-op */ }
  }
}
