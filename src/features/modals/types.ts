// ============================================================================
// Modal types — Phase TS-9.
//
// Minimal shared types for the 3 modals (event / role / inspi). Each
// modal keeps its OWN lifecycle and internal state — there is no
// ModalManager or BaseModal abstraction (deliberate per migration
// directive: "PAS d'abstraction commune artificielle").
// ============================================================================

/** Discriminator for the 3 modals the harness already exercises (SC14–21). */
export type ModalKind = 'eventModal' | 'roleModal' | 'inspiModal';

/** Inspi draft — the working state of an in-progress inspiration. */
export interface InspiDraft {
  mediaType?: 'image' | 'video' | 'embed' | 'note' | 'link' | string;
  mediaUrl?: string;
  mediaEmbed?: string;
  provider?: string;
  aspect?: string;
  _filename?: string;
  _file?: File;
  _isLocalBlob?: boolean;
}
