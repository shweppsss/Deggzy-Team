// ============================================================================
// Detail renderer — inspiration kind. Phase TS-7.
// Pure function: (entity, deps) => string. No globals, no DOM.
// ============================================================================

import type { RenderDeps } from './shared';

export interface InspiEntity {
  id: string;
  type?: string;
  title?: string;
  category?: string;
  data?: string;
  dataType?: string;
  url?: string;
  notes?: string;
}

export function renderInspi(i: InspiEntity, deps: RenderDeps): string {
  const esc = deps.escapeHtml;

  let media = '';
  if (i.type === 'image' && i.data) {
    if (i.dataType && i.dataType.startsWith('video')) {
      media = `<video src="${i.data}" controls class="inspi-media-video"></video>`;
    } else {
      media = `<img src="${i.data}" class="inspi-media-image" />`;
    }
  } else if (i.type === 'link') {
    media = `<div class="inspi-media-link-glyph">↗</div>`;
  } else {
    media = `<div class="inspi-media-note-glyph">"${esc(i.title)}"</div>`;
  }

  return `
    <div class="detail-hero">
      <div class="detail-eyebrow">Inspiration · <span contenteditable="true" onblur="updateInspiField('${i.id}','category',this.innerText.trim())">${esc(i.category || 'Autre')}</span></div>
      <div class="detail-title" contenteditable="true" onblur="updateInspiField('${i.id}','title',this.innerText.trim())">${esc(i.title || 'Sans titre')}</div>
    </div>
    ${media}
    <div class="detail-section inspi-section-spacer">
      <h3>Notes / Pourquoi cette référence</h3>
      <textarea class="inspi-textarea-notes" placeholder="À remplir..." onblur="updateInspiField('${i.id}','notes',this.value)">${esc(i.notes || '')}</textarea>
      ${i.type === 'link' ? `
        <div class="detail-field inspi-field-spacer"><label>URL</label><input value="${esc(i.url || '')}" onchange="updateInspiField('${i.id}','url',this.value)" /></div>
      ` : ''}
      ${i.url ? `<div class="inspi-field-spacer"><a href="${i.url}" target="_blank" rel="noopener" style="color:#7AB5C9; word-break:break-all;">${esc(i.url)} ↗</a></div>` : ''}
    </div>
    <div class="detail-actions">
      <button class="btn btn-danger" onclick="deleteInspiById('${i.id}'); closeDetail();">Supprimer</button>
      <button class="btn btn-primary" data-detail-close>Fermer</button>
    </div>
  `;
}
