// ============================================================================
// Detail renderer — team member kind. Phase TS-7.
// Pure function: (entity, deps) => string. No globals, no DOM.
// ============================================================================

import type { RenderDeps } from './shared';

export interface MemberEntity {
  id: string;
  name?: string;
  role?: string;
  note?: string;
  contact?: string;
}

export function renderMember(m: MemberEntity, deps: RenderDeps): string {
  const esc = deps.escapeHtml;

  return `
    <div class="detail-hero">
      <div class="detail-eyebrow">${esc(m.role)}</div>
      <div class="detail-title" contenteditable="true" onblur="updateMemberField('${m.id}','name',this.innerText)">${esc(m.name)}</div>
    </div>
    <div class="detail-section">
      <h3>Informations</h3>
      <div class="detail-field"><label>Rôle</label><input value="${esc(m.role)}" onchange="updateMemberField('${m.id}','role',this.value)" /></div>
      <div class="detail-field"><label>Notes / Mission</label><textarea onblur="updateMemberField('${m.id}','note',this.value)">${esc(m.note || '')}</textarea></div>
      <div class="detail-field"><label>Contact (téléphone / email / IG)</label><input placeholder="—" value="${esc(m.contact || '')}" onchange="updateMemberField('${m.id}','contact',this.value)" /></div>
    </div>
    <div class="detail-actions">
      <button class="btn btn-danger" onclick="deleteMember('${m.id}'); closeDetail();">Supprimer</button>
      <button class="btn btn-primary" data-detail-close>Fermer</button>
    </div>
  `;
}
