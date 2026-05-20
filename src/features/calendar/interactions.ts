// ============================================================================
// Calendar interactions — wire up DOM listeners for week + month views.
// Phase TS-16.
// ============================================================================

import type { CalendarDeps } from './types';
import { onWeekEventPointerDown } from './week-drag';
import { onWeekEventResizeDown } from './week-resize';
import { onCalEventPointerDown, isMonthDragStarted } from './month-drag';

let _deps: CalendarDeps | null = null;

export function registerInteractionsDeps(deps: CalendarDeps): void {
  _deps = deps;
}

/** Attach pointer listeners for week-view: empty slot click + drag + resize. */
export function attachWeekInteractions(): void {
  if (!_deps) return;
  const grid = document.getElementById('calendarGrid');
  if (!grid) return;
  grid.querySelectorAll<HTMLElement>('.cal-week-hour-slot').forEach((slot) => {
    slot.addEventListener('click', (e) => {
      if (isMonthDragStarted()) return;
      if (e.target instanceof Element && e.target.closest('.cal-week-event')) return;
      const date = slot.dataset.date;
      const hour = parseInt(slot.dataset.hour || '0', 10);
      if (!date || !_deps) return;
      _deps.openEventModal(date);
      if (_deps.prefillEventTimeHour) {
        setTimeout(() => _deps && _deps.prefillEventTimeHour && _deps.prefillEventTimeHour(hour), 50);
      }
    });
  });
  grid.querySelectorAll<HTMLElement>('.cal-week-event[data-event-id]').forEach((pill) => {
    pill.addEventListener('pointerdown', onWeekEventPointerDown as EventListener);
  });
  grid.querySelectorAll<HTMLElement>('.cal-week-event-resize').forEach((handle) => {
    handle.addEventListener('pointerdown', onWeekEventResizeDown as EventListener);
  });
}

/** Attach pointer listeners for month-view: empty cell click + drag. */
export function attachCalendarInteractions(): void {
  if (!_deps) return;
  const grid = document.getElementById('calendarGrid');
  if (!grid) return;
  grid.querySelectorAll<HTMLElement>('.cal-cell[data-date]').forEach((cell) => {
    cell.addEventListener('click', (e) => {
      if (isMonthDragStarted()) return;
      if (e.target instanceof Element && e.target.closest('.cal-event')) return;
      if (cell.dataset.date && _deps) _deps.openEventModal(cell.dataset.date);
    });
  });
  grid.querySelectorAll<HTMLElement>('.cal-event[data-event-id]').forEach((pill) => {
    pill.addEventListener('pointerdown', onCalEventPointerDown as EventListener);
  });
}
