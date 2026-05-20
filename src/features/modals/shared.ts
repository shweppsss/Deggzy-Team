// ============================================================================
// Modal shared helpers — Phase TS-9. INTENTIONALLY MINIMAL.
//
// Per migration directive: "PAS de ModalManager générique / PAS
// d'abstraction commune artificielle / PAS de classe BaseModal." Each
// modal keeps its own lifecycle. This file only collects the 2-3
// micro-helpers that ALL modals literally do verbatim, so the codepath
// for "open this modal" / "close this modal" stays a one-liner in each
// per-modal file.
// ============================================================================

import type { ModalKind } from './types';

/** Add the `.open` class on the modal element. Idempotent. No-op if missing. */
export function showModal(kind: ModalKind): void {
  const el = document.getElementById(kind);
  if (el) el.classList.add('open');
}

/** Remove the `.open` class on the modal element. Idempotent. No-op if missing. */
export function hideModal(kind: ModalKind): void {
  const el = document.getElementById(kind);
  if (el) el.classList.remove('open');
}

/** Read a DOM input/select/textarea by id. Returns '' if not found. */
export function getFieldValue(id: string): string {
  const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
  return el ? el.value : '';
}

/** Write a DOM input/select/textarea by id. No-op if not found. */
export function setFieldValue(id: string, value: string): void {
  const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
  if (el) el.value = value;
}

/** Set textContent of an element by id. No-op if not found. */
export function setTextById(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
