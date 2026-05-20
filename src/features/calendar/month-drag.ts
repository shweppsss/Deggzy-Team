// ============================================================================
// Month-view drag — move events between days. Phase TS-16.
//
// Pointer Events; document-level listeners survive mid-drag re-renders;
// 5px threshold preserves click semantics; ghost clone of the pill follows
// the pointer; cell highlight tracks the drop target. Escape cancels.
// ============================================================================

import type { CalendarDeps, MonthDragState } from './types';
import { DRAG_THRESHOLD_PX } from './preview';

let _calDrag: MonthDragState | null = null;
let _deps: CalendarDeps | null = null;

export function registerMonthDragDeps(deps: CalendarDeps): void {
  _deps = deps;
}

/** Test hook: current drag state (read-only). */
export function _getMonthDragState(): Readonly<MonthDragState> | null {
  return _calDrag;
}

/** Test hook: reset module state. */
export function _resetMonthDrag(): void {
  if (_calDrag) cleanupCalDrag(null);
  _calDrag = null;
}

/** Whether a month drag is currently in the "started" phase (used by interactions.ts). */
export function isMonthDragStarted(): boolean {
  return !!(_calDrag && _calDrag.started);
}

export function onCalEventPointerDown(e: PointerEvent): void {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (_calDrag) cleanupCalDrag(null);
  const pill = e.currentTarget as HTMLElement;
  const id = pill.dataset.eventId;
  if (!id) return;
  e.preventDefault();
  e.stopPropagation();
  const rect = pill.getBoundingClientRect();
  try { pill.setPointerCapture(e.pointerId); } catch { /* unsupported */ }
  _calDrag = {
    id,
    pill,
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    width: rect.width,
    ghost: null,
    started: false,
    lastCell: null,
  };
  document.addEventListener('pointermove', onCalEventPointerMove);
  document.addEventListener('pointerup', onCalEventPointerUp);
  document.addEventListener('pointercancel', onCalEventPointerUp);
  document.addEventListener('keydown', onCalDragKeydown);
}

function onCalEventPointerMove(e: PointerEvent): void {
  if (!_calDrag) return;
  const dx = e.clientX - _calDrag.startX;
  const dy = e.clientY - _calDrag.startY;
  if (!_calDrag.started) {
    if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
    _calDrag.started = true;
    _calDrag.pill.classList.add('cal-event-dragging');
    const ghost = _calDrag.pill.cloneNode(true) as HTMLElement;
    ghost.classList.add('cal-event-ghost');
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '9999';
    ghost.style.width = _calDrag.width + 'px';
    ghost.style.left = (e.clientX - _calDrag.offsetX) + 'px';
    ghost.style.top = (e.clientY - _calDrag.offsetY) + 'px';
    document.body.appendChild(ghost);
    _calDrag.ghost = ghost;
    if (_deps?.haptic) _deps.haptic(15);
  }
  if (_calDrag.ghost) {
    _calDrag.ghost.style.left = (e.clientX - _calDrag.offsetX) + 'px';
    _calDrag.ghost.style.top = (e.clientY - _calDrag.offsetY) + 'px';
  }
  if (_calDrag.ghost) _calDrag.ghost.style.display = 'none';
  const elBelow = document.elementFromPoint(e.clientX, e.clientY);
  if (_calDrag.ghost) _calDrag.ghost.style.display = '';
  const candidate = elBelow && elBelow instanceof Element
    ? elBelow.closest('.cal-cell[data-date]') as HTMLElement | null
    : null;
  if (candidate !== _calDrag.lastCell) {
    if (_calDrag.lastCell) _calDrag.lastCell.classList.remove('cal-cell-droptarget');
    if (candidate) candidate.classList.add('cal-cell-droptarget');
    _calDrag.lastCell = candidate;
  }
}

function onCalEventPointerUp(e: PointerEvent): void {
  if (!_calDrag || !_deps) return;
  const id = _calDrag.id;
  const wasDrag = _calDrag.started;
  const dropDate = _calDrag.lastCell ? _calDrag.lastCell.dataset.date || null : null;
  cleanupCalDrag(e);

  if (wasDrag) {
    if (!dropDate) return;
    const ev = _deps.findEvent(id);
    if (!ev || ev.date === dropDate) return;
    ev.date = dropDate;
    _deps.stampEventUpdate(ev);
    _deps.save();
    _deps.renderCalendar();
    _deps.renderDashboard();
    _deps.toast('📅 Déplacé au ' + new Date(dropDate + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
    if (_deps.haptic) _deps.haptic(20);
    return;
  }
  _deps.openDetail('event', id);
}

function onCalDragKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && _calDrag) {
    e.preventDefault();
    _calDrag.started = false;
    _calDrag.lastCell = null;
    cleanupCalDrag(null);
  }
}

function cleanupCalDrag(e: PointerEvent | null): void {
  document.querySelectorAll('.cal-event-ghost').forEach((g) => g.remove());
  document.querySelectorAll('.cal-event-dragging').forEach((p) => p.classList.remove('cal-event-dragging'));
  document.querySelectorAll('.cal-cell-droptarget').forEach((c) => c.classList.remove('cal-cell-droptarget'));
  document.removeEventListener('pointermove', onCalEventPointerMove);
  document.removeEventListener('pointerup', onCalEventPointerUp);
  document.removeEventListener('pointercancel', onCalEventPointerUp);
  document.removeEventListener('keydown', onCalDragKeydown);
  if (_calDrag) {
    if (_calDrag.pill && e) {
      try { _calDrag.pill.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    _calDrag = null;
  }
}
