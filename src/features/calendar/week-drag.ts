// ============================================================================
// Week-view drag — move events to a new (date, time). Phase TS-16.
//
// Pointer Events end-to-end so the same code drives mouse, trackpad, and
// touch. Document-level listeners survive mid-drag re-renders (e.g. realtime
// sync destroys+recreates the source pill). Escape cancels and reverts.
// ============================================================================

import { minsToTime } from '../../lib/format-utils';
import type { CalendarDeps, WeekDragState } from './types';
import {
  DRAG_THRESHOLD_PX,
  HOUR_HEIGHT_PX,
  WEEK_START_HOUR,
  snapWeekMoveMins,
} from './preview';

let _weekDrag: WeekDragState | null = null;
let _deps: CalendarDeps | null = null;

export function registerWeekDragDeps(deps: CalendarDeps): void {
  _deps = deps;
}

/** Test hook: current drag state (read-only). */
export function _getWeekDragState(): Readonly<WeekDragState> | null {
  return _weekDrag;
}

/** Test hook: reset module state between scenarios. */
export function _resetWeekDrag(): void {
  if (_weekDrag) cleanupWeekDrag(null);
  _weekDrag = null;
}

export function onWeekEventPointerDown(e: PointerEvent): void {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  // Resize handle has its own listener that stops propagation. Belt-and-suspenders:
  if (e.target instanceof Element && e.target.closest('.cal-week-event-resize')) return;
  if (_weekDrag) cleanupWeekDrag(null);

  const pill = e.currentTarget as HTMLElement;
  const id = pill.dataset.eventId;
  if (!id) return;
  e.preventDefault();
  e.stopPropagation();
  const rect = pill.getBoundingClientRect();
  try { pill.setPointerCapture(e.pointerId); } catch { /* unsupported */ }
  _weekDrag = {
    id,
    pill,
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    width: rect.width,
    height: rect.height,
    ghost: null,
    started: false,
    targetDate: null,
    targetMins: null,
  };
  document.addEventListener('pointermove', onWeekEventPointerMove);
  document.addEventListener('pointerup', onWeekEventPointerUp);
  document.addEventListener('pointercancel', onWeekEventPointerUp);
  document.addEventListener('keydown', onWeekDragKeydown);
}

function onWeekEventPointerMove(e: PointerEvent): void {
  if (!_weekDrag) return;
  const dx = e.clientX - _weekDrag.startX;
  const dy = e.clientY - _weekDrag.startY;
  if (!_weekDrag.started) {
    if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
    _weekDrag.started = true;
    _weekDrag.pill.classList.add('cal-event-dragging');
    const ghost = _weekDrag.pill.cloneNode(true) as HTMLElement;
    ghost.classList.add('cal-event-ghost');
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '9999';
    ghost.style.width = _weekDrag.width + 'px';
    ghost.style.height = _weekDrag.height + 'px';
    ghost.style.left = (e.clientX - _weekDrag.offsetX) + 'px';
    ghost.style.top = (e.clientY - _weekDrag.offsetY) + 'px';
    document.body.appendChild(ghost);
    _weekDrag.ghost = ghost;
    if (_deps?.haptic) _deps.haptic(15);
  }
  if (_weekDrag.ghost) {
    _weekDrag.ghost.style.left = (e.clientX - _weekDrag.offsetX) + 'px';
    _weekDrag.ghost.style.top = (e.clientY - _weekDrag.offsetY) + 'px';
  }
  // Drop target: a `.cal-week-day` column + y-offset → hour
  if (_weekDrag.ghost) _weekDrag.ghost.style.display = 'none';
  const elBelow = document.elementFromPoint(e.clientX, e.clientY);
  if (_weekDrag.ghost) _weekDrag.ghost.style.display = '';
  const dayCol = elBelow && elBelow instanceof Element
    ? elBelow.closest('.cal-week-day[data-date]') as HTMLElement | null
    : null;
  if (!dayCol) {
    _weekDrag.targetDate = null;
    _weekDrag.targetMins = null;
    return;
  }
  const colRect = dayCol.getBoundingClientRect();
  const ghostTop = e.clientY - _weekDrag.offsetY;
  const relY = Math.max(0, ghostTop - colRect.top);
  _weekDrag.targetDate = dayCol.dataset.date || null;
  _weekDrag.targetMins = snapWeekMoveMins(relY, WEEK_START_HOUR, HOUR_HEIGHT_PX);
}

function onWeekEventPointerUp(e: PointerEvent): void {
  if (!_weekDrag || !_deps) return;
  const id = _weekDrag.id;
  const wasDrag = _weekDrag.started;
  const targetDate = _weekDrag.targetDate;
  const targetMins = _weekDrag.targetMins;
  cleanupWeekDrag(e);

  if (wasDrag) {
    if (!targetDate || targetMins == null) return;
    const ev = _deps.findEvent(id);
    if (!ev) return;
    const newTime = minsToTime(targetMins);
    if (ev.date === targetDate && ev.time === newTime) return;
    ev.date = targetDate;
    ev.time = newTime;
    _deps.stampEventUpdate(ev);
    _deps.save();
    _deps.renderCalendar();
    _deps.renderDashboard();
    const dateLabel = new Date(targetDate + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    _deps.toast('📅 Déplacé : ' + dateLabel + ' à ' + newTime);
    if (_deps.haptic) _deps.haptic(20);
    return;
  }
  _deps.openDetail('event', id);
}

function onWeekDragKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && _weekDrag) {
    e.preventDefault();
    _weekDrag.started = false;
    _weekDrag.targetDate = null;
    cleanupWeekDrag(null);
  }
}

function cleanupWeekDrag(e: PointerEvent | null): void {
  document.querySelectorAll('.cal-event-ghost').forEach((g) => g.remove());
  document.querySelectorAll('.cal-event-dragging').forEach((p) => p.classList.remove('cal-event-dragging'));
  document.removeEventListener('pointermove', onWeekEventPointerMove);
  document.removeEventListener('pointerup', onWeekEventPointerUp);
  document.removeEventListener('pointercancel', onWeekEventPointerUp);
  document.removeEventListener('keydown', onWeekDragKeydown);
  if (_weekDrag) {
    if (_weekDrag.pill && e) {
      try { _weekDrag.pill.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    _weekDrag = null;
  }
}
