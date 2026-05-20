// ============================================================================
// Modals barrel — Phase TS-9.
// Re-exports the open / close / draft-management surface of all 3 modals.
// ============================================================================

export type { ModalKind, InspiDraft } from './types';

export {
  openEventModal,
  closeEventModal,
  setEventVisibility,
  refreshRecurrenceUntilVisibility,
  getEditingEventId,
  setEditingEventId,
} from './event-modal';

export {
  openRoleModal,
  closeRoleModal,
  selectRole,
  getPendingRoleKey,
} from './role-modal';

export {
  openInspiLink,
  closeInspiModal,
  showInspiPreview,
  clearInspiDraft,
  handleInspiUrlChange,
  handleInspiModalFile,
  getInspiDraft,
} from './inspi-modal';
