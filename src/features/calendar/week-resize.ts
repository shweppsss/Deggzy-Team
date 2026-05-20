// ============================================================================
// Week-view resize — drag the bottom handle to grow/shrink an event's
// duration. 15-min snap, min 15 min, max until 23:59 of the same day. Escape
// cancels and reverts. Phase TS-16.
// ============================================================================

import { timeToMins, formatEventRange, formatDuration } from '../../lib/format-utils';
import type { CalendarDeps, WeekResizeState } from './types';
import { HOUR_HEIGHT_PX, RESIZE_SNAP_MIN, snapWeekResizeDuration } from './preview';

let _weekResize: WeekResizeState | null = null;
let _deps: CalendarDeps | null = null;

export function registerWeekResizeDeps(deps: CalendarDeps): void {
  _deps = deps;
}

/** Test hook: current resize state (read-only). */
export function _getWeekResizeState(): Readonly<WeekResizeState> | null {
  return _weekResize;
}

/** Test hook: reset module state. */
export function _resetWeekResize(): void {
  if (_weekResize) cleanupWeekResize(null);
  _weekResize = null;
}

export function onWeekEventResizeDown(e: PointerEvent): void {
  if (!_deps) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const handle = e.currentTarget as HTMLElement;
  const pill = handle.closest('.cal-week-event[data-event-id]') as HTMLElement | null;
  if (!pill) return;
  const id = pill.dataset.eventId;
  if (!id) return;
  const ev = _deps.findEvent(id);
  if (!ev) return;
  if (_weekResize) cleanupWeekResize(null);
  try { handle.setPointerCapture(e.pointerId); } catch { /* unsupported */ }
  const startMins = timeToMins(ev.time);
  if (startMins == null) return; // all-day events don't have a resize handle
  const startDuration = Math.max(15, parseInt(String(ev.duration ?? 60), 10) || 60);
  _weekResize = {
    id,
    pill,
    handle,
    pointerId: e.pointerId,
    startY: e.clientY,
    startDuration,
    startMins,
    currentDuration: startDuration,
    cancelled: false,
  };
  pill.classList.add('cal-event-resizing');
  document.addEventListener('pointermove', onWeekEventResizeMove);
  document.addEventListener('pointerup', onWeekEventResizeUp);
  document.addEventListener('pointercancel', onWeekEventResizeUp);
  document.addEventListener('keydown', onWeekResizeKeydown);
}

function onWeekEventResizeMove(e: PointerEvent): void {
  if (!_weekResize || !_deps) return;
  const dy = e.clientY - _weekResize.startY;
  const next = snapWeekResizeDuration(
    _weekResize.startDuration,
    dy,
    _weekResize.startMins,
    HOUR_HEIGHT_PX,
    RESIZE_SNAP_MIN,
  );
  if (next === _weekResize.currentDuration) return;
  _weekResize.currentDuration = next;
  const newHeight = (next / 60) * HOUR_HEIGHT_PX - 4;
  _weekResize.pill.style.height = newHeight + 'px';
  const timeEl = _weekResize.pill.querySelector('.cal-week-event-time');
  if (timeEl) {
    const ev = _deps.findEvent(_weekResize.id);
    if (ev && ev.time) timeEl.textContent = formatEventRange(ev.time, next);
  }
}

function onWeekEventResizeUp(e: PointerEvent): void {
  if (!_weekResize || !_deps) return;
  const cancelled = _weekResize.cancelled;
  const id = _weekResize.id;
  const newDuration = _weekResize.currentDuration;
  const startDuration = _weekResize.startDuration;
  cleanupWeekResize(e);
  if (cancelled) {
    _deps.renderCalendar();
    return;
  }
  if (newDuration === startDuration) return;
  const ev = _deps.findEvent(id);
  if (!ev) return;
  ev.duration = newDuration;
  _deps.stampEventUpdate(ev);
  _deps.save();
  _deps.renderCalendar();
  _deps.renderDashboard();
  _deps.toast('⏱️ Durée : ' + formatDuration(newDuration));
  if (_deps.haptic) _deps.haptic(15);
}

function onWeekResizeKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && _weekResize && _deps) {
    e.preventDefault();
    _weekResize.cancelled = true;
    cleanupWeekResize(null);
    _deps.renderCalendar();
  }
}

function cleanupWeekResize(e: PointerEvent | null): void {
  document.querySelectorAll('.cal-event-resizing').forEach((p) => p.classList.remove('cal-event-resizing'));
  document.removeEventListener('pointermove', onWeekEventResizeMove);
  document.removeEventListener('pointerup', onWeekEventResizeUp);
  document.removeEventListener('pointercancel', onWeekEventResizeUp);
  document.removeEventListener('keydown', onWeekResizeKeydown);
  if (_weekResize) {
    if (_weekResize.handle && e) {
      try { _weekResize.handle.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    _weekResize = null;
  }
}
