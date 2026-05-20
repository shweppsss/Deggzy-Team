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
      media = `<video src="${i.data}" controls style="width:100%; max-height:500px; background:#000; border-radius:var(--radius);"></video>`;
    } else {
      media = `<img src="${i.data}" style="width:100%; max-height:500px; object-fit:contain; background:#000; border-radius:var(--radius);" />`;
    }
  } else if (i.type === 'link') {
    media = `<div style="padding:60px; background: var(--surface); border-radius:var(--radius); text-align:center; font-size:48px; color:#7AB5C9;">↗</div>`;
  } else {
    media = `<div style="padding:80px 40px; background: var(--accent-soft); border-radius:var(--radius); text-align:center; font-size:36px; font-weight:800; color: var(--accent);">"${esc(i.title)}"</div>`;
  }

  return `
    <div class="detail-hero">
      <div class="detail-eyebrow">Inspiration · <span contenteditable="true" onblur="updateInspiField('${i.id}','category',this.innerText.trim())">${esc(i.category || 'Autre')}</span></div>
      <div class="detail-title" contenteditable="true" onblur="updateInspiField('${i.id}','title',this.innerText.trim())">${esc(i.title || 'Sans titre')}</div>
    </div>
    ${media}
    <div class="detail-section" style="margin-top:24px;">
      <h3>Notes / Pourquoi cette référence</h3>
      <textarea style="width:100%; min-height: 120px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; color: var(--text); font-family: inherit; font-size: 14px; line-height: 1.5;" placeholder="À remplir..." onblur="updateInspiField('${i.id}','notes',this.value)">${esc(i.notes || '')}</textarea>
      ${i.type === 'link' ? `
        <div class="detail-field" style="margin-top:14px;"><label>URL</label><input value="${esc(i.url || '')}" onchange="updateInspiField('${i.id}','url',this.value)" /></div>
      ` : ''}
      ${i.url ? `<div style="margin-top:14px;"><a href="${i.url}" target="_blank" rel="noopener" style="color:#7AB5C9; word-break:break-all;">${esc(i.url)} ↗</a></div>` : ''}
    </div>
    <div class="detail-actions">
      <button class="btn btn-danger" onclick="deleteInspiById('${i.id}'); closeDetail();">Supprimer</button>
      <button class="btn btn-primary" data-detail-close>Fermer</button>
    </div>
  `;
}
