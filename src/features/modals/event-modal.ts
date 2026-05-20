// ============================================================================
// Event modal — open / close / form hydration. Phase TS-9.
//
// Lifecycle ONLY. The save flow (saveEvent / deleteEvent) is NOT in this
// PR — it depends on _stampEventCreate / _stampEventUpdate / logActivity /
// render dispatch that are still inline. Those migrate in a future PR.
//
// What IS here:
//   - openEventModal(date?, eventId?)  — show, populate fields for edit or
//     create, set the visibility toggle, refresh recurrence-until visibility.
//   - closeEventModal()                — hide.
//   - _setEventVisibility(value)       — sync the segmented toggle.
//   - _refreshRecurrenceUntilVisibility() — show/hide the "until" date field
//     based on the current recurrence selection.
//
// All accesses to legacy state go through `/src/lib/legacy-bridge` (state).
// Domain helpers (tagsToInput) come from `/src/features/detail/domain`.
// No `window.X` reads here.
// ============================================================================

import { showModal, hideModal, setFieldValue, setTextById } from './shared';
import { tagsToInput } from '../detail/domain';
import { getLegacyState, type BridgedEntity } from '../../lib/legacy-bridge';

// Module-private state — replaces the inline `var editingEventId` so the
// save flow inline can still read it via window (see main.ts shim).
let _editingEventId: string | null = null;

export function getEditingEventId(): string | null {
  return _editingEventId;
}

export function setEditingEventId(id: string | null): void {
  _editingEventId = id;
}

/** Read a typed field for the event modal. Returns '' if not in the DOM. */
function field(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null)?.value ?? '';
}

/**
 * Sync the segmented visibility toggle (Équipe / Privé). Writes the hidden
 * input AND updates the .active class + aria-checked on the two buttons.
 */
export function setEventVisibility(value: string): void {
  const v = value === 'private' ? 'private' : 'team';
  const hidden = document.getElementById('eventVisibility') as HTMLInputElement | null;
  if (hidden) hidden.value = v;
  document.querySelectorAll<HTMLElement>('#eventModal .visibility-option').forEach((btn) => {
    const active = btn.dataset.visibility === v;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', active ? 'true' : 'false');
  });
}

/**
 * "Jusqu'au" only makes sense once a recurrence is picked; hide the field
 * for "Aucune" and show it otherwise.
 */
export function refreshRecurrenceUntilVisibility(): void {
  const freq = field('eventRecurrence') || 'none';
  const wrap = document.getElementById('eventRecurrenceUntilField');
  if (wrap) wrap.style.display = freq === 'none' ? 'none' : '';
}

/**
 * Open the event modal. With `eventId` → edit mode (populate from state).
 * Without → create mode (defaults). The save flow (inline) reads
 * `_editingEventId` via the window mirror to decide create-vs-update.
 */
export function openEventModal(date: string | null = null, eventId: string | null = null): void {
  const modal = document.getElementById('eventModal');
  if (!modal) return;
  modal.classList.add('open');

  const deleteBtn = document.getElementById('eventDelete') as HTMLElement | null;
  if (deleteBtn) deleteBtn.style.display = eventId ? 'inline-flex' : 'none';

  if (eventId) {
    _editingEventId = eventId;
    const events = getLegacyState().events;
    const e: BridgedEntity | undefined = Array.isArray(events) ? events.find((x) => x.id === eventId) : undefined;
    if (!e) {
      // Event vanished between catalog render and modal open — fail gracefully.
      _editingEventId = null;
      hideModal('eventModal');
      return;
    }
    setTextById('eventModalTitle', 'Modifier événement');
    setFieldValue('eventTitle', String(e.title || ''));
    setFieldValue('eventDate', String(e.date || ''));
    setFieldValue('eventTime', String(e.time || ''));
    setFieldValue('eventDuration', String(e.duration || 60));
    setFieldValue('eventType', String(e.type || 'meeting'));
    setFieldValue('eventLocation', String(e.location || ''));
    setFieldValue('eventWith', String(e.with || ''));
    setFieldValue('eventNotes', String(e.notes || ''));
    setFieldValue('eventTags', tagsToInput(e.tags));
    setFieldValue('eventEndDate', String(e.endDate || ''));
    const recurrence = e.recurrence as { freq?: string; until?: string } | undefined;
    setFieldValue('eventRecurrence', recurrence?.freq || 'none');
    setFieldValue('eventRecurrenceUntil', recurrence?.until || '');
    setEventVisibility(e.visibility === 'private' ? 'private' : 'team');
  } else {
    _editingEventId = null;
    setTextById('eventModalTitle', 'Nouvel événement');
    setFieldValue('eventTitle', '');
    setFieldValue('eventDate', date || new Date().toISOString().slice(0, 10));
    setFieldValue('eventTime', '');
    setFieldValue('eventDuration', '60');
    setFieldValue('eventType', 'meeting');
    setFieldValue('eventLocation', '');
    setFieldValue('eventWith', '');
    setFieldValue('eventNotes', '');
    setFieldValue('eventTags', '');
    setFieldValue('eventEndDate', '');
    setFieldValue('eventRecurrence', 'none');
    setFieldValue('eventRecurrenceUntil', '');
    setEventVisibility('team');
  }
  refreshRecurrenceUntilVisibility();
}

/** Close the event modal. */
export function closeEventModal(): void {
  hideModal('eventModal');
}
// Avoid an unused-import warning when only showModal is used elsewhere.
void showModal;
