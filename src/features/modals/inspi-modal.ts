// ============================================================================
// Inspi modal — open / close / draft hydration. Phase TS-9.
//
// Lifecycle + draft hydration. The save flow (saveInspiLink — touches IDB,
// Supabase Storage, state mutation, multiple render dispatches) stays
// inline; it reads the working draft via `getInspiDraft()`.
//
// What IS here:
//   - openInspiLink()              — clear inputs, blank draft, show modal,
//                                    reset preview to default dropzone.
//   - closeInspiModal()            — hide modal, drop the draft.
//   - showInspiPreview()           — repaint the preview area from the draft.
//   - clearInspiDraft()            — drop the draft + clear the URL field +
//                                    re-show the default dropzone.
//   - handleInspiUrlChange()       — parse the URL field through legacy
//                                    parseMedia(), update the draft.
//   - handleInspiModalFile(file)   — turn an uploaded File into a draft
//                                    with a transient blob preview URL.
//   - getInspiDraft()              — for the inline saveInspiLink to read.
// ============================================================================

import type { InspiDraft } from './types';
import { showModal, hideModal, setFieldValue } from './shared';
import { escapeHtml } from '../../lib/format-utils';
import { icon } from '../../lib/render-utils';
import { parseMedia, checkFileSize, toast } from '../../lib/legacy-bridge';
import { viewTransition } from '../mobile/transitions';

let _inspiDraft: InspiDraft | null = null;

export function getInspiDraft(): InspiDraft | null {
  return _inspiDraft;
}

/**
 * Build the inner HTML for the preview area from a non-null draft.
 * Pure: takes the draft + the imported `icon` helper, returns a string.
 */
function buildPreviewInner(d: InspiDraft): string {
  let inner = '';
  if (d.mediaType === 'image') {
    inner = `<img src="${d.mediaUrl}" alt="Preview" class="inspi-preview-img" />`;
  } else if (d.mediaType === 'video') {
    inner = `<video src="${d.mediaUrl}" class="inspi-preview-img" controls muted playsinline></video>`;
  } else if (d.mediaType === 'embed' && d.mediaEmbed) {
    const aspect = d.aspect || '16/9';
    inner = `<div class="inspi-preview-embed" style="aspect-ratio:${aspect};">${d.mediaEmbed}</div>`;
  } else if (d.mediaType === 'embed' && d.provider === 'tiktok') {
    inner = `<div class="inspi-preview-link">${icon('link', 18)} <span>TikTok détecté — sera affiché en card</span></div>`;
  } else {
    inner = `<div class="inspi-preview-link">${icon('link', 18)} <span>${escapeHtml(d.mediaUrl || '')}</span></div>`;
  }
  inner += `<button type="button" class="inspi-preview-clear" onclick="clearInspiDraft()" aria-label="Retirer">${icon('close', 14)}</button>`;
  return inner;
}

/**
 * Repaint the preview area to reflect `_inspiDraft`. Called from the
 * URL change handler, the file handler, and clearInspiDraft.
 */
export function showInspiPreview(): void {
  const previewWrap = document.getElementById('inspiPreviewWrap');
  const defaultBox = document.getElementById('inspiDropzoneDefault');
  if (!previewWrap || !defaultBox) return;
  if (!_inspiDraft) {
    previewWrap.innerHTML = '';
    (previewWrap as HTMLElement).hidden = true;
    (defaultBox as HTMLElement).hidden = false;
    return;
  }
  viewTransition(() => { previewWrap.innerHTML = buildPreviewInner(_inspiDraft!); });
  (previewWrap as HTMLElement).hidden = false;
  (defaultBox as HTMLElement).hidden = true;
}

export function clearInspiDraft(): void {
  _inspiDraft = null;
  setFieldValue('inspiUrl', '');
  showInspiPreview();
}

export function handleInspiUrlChange(): void {
  const urlEl = document.getElementById('inspiUrl') as HTMLInputElement | null;
  const url = urlEl ? urlEl.value.trim() : '';
  if (!url) {
    _inspiDraft = null;
    showInspiPreview();
    return;
  }
  const parsed = parseMedia(url) as InspiDraft | null;
  if (!parsed) return;
  _inspiDraft = parsed;
  showInspiPreview();
}

export async function handleInspiModalFile(file: File | null | undefined): Promise<void> {
  if (!file) return;
  // checkFileSize toasts on rejection; we just bail.
  if (!checkFileSize(file)) return;
  try {
    const previewUrl = URL.createObjectURL(file);
    const isVideo = (file.type || '').startsWith('video');
    _inspiDraft = {
      mediaType: isVideo ? 'video' : 'image',
      mediaUrl: previewUrl,
      mediaEmbed: '',
      provider: '',
      _filename: file.name,
      _file: file,
      _isLocalBlob: true,
    };
    showInspiPreview();
    const titleInput = document.getElementById('inspiTitle') as HTMLInputElement | null;
    if (titleInput && !titleInput.value.trim()) {
      titleInput.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    }
  } catch (_e) {
    toast('Erreur de chargement.');
  }
}

/**
 * Open the modal: blank draft, reset inputs to defaults, show. The display
 * name `openInspiLink` is kept from the inline original (it's bound as an
 * onclick attribute throughout the HTML).
 */
export function openInspiLink(): void {
  _inspiDraft = null;
  showModal('inspiModal');
  setFieldValue('inspiTitle', '');
  setFieldValue('inspiUrl', '');
  setFieldValue('inspiNotes', '');
  setFieldValue('inspiType', 'link');
  setFieldValue('inspiCategory', 'Mood');
  const previewWrap = document.getElementById('inspiPreviewWrap');
  const defaultBox = document.getElementById('inspiDropzoneDefault');
  if (previewWrap) {
    previewWrap.innerHTML = '';
    (previewWrap as HTMLElement).hidden = true;
  }
  if (defaultBox) (defaultBox as HTMLElement).hidden = false;
}

export function closeInspiModal(): void {
  hideModal('inspiModal');
  _inspiDraft = null;
}
