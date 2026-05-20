// ============================================================================
// Detail renderer — event kind. Phase TS-7.
// Pure function: (entity, deps, context) => string. No globals, no DOM.
// ============================================================================

import type { RenderDeps } from './shared';

/** Minimal event shape required by the renderer. Loose enough to accept
 *  whatever the legacy state stores. */
export interface EventEntity {
  id: string;
  title?: string;
  type?: string;
  date?: string;
  time?: string;
  duration?: number | string;
  location?: string;
  with?: string;
  notes?: string;
  visibility?: string;
  createdBy?: { name?: string };
  updatedBy?: { name?: string };
  createdAt?: number | string;
  updatedAt?: number | string;
}

/** Related entities pre-resolved by lifecycle.ts — keeps the renderer pure. */
export interface EventRenderContext {
  /** Track whose name matches the event title (legacy heuristic). Null if none. */
  relatedTrack: { id: string; name?: string } | null;
}

export function renderEvent(e: EventEntity, deps: RenderDeps, ctx: EventRenderContext): string {
  const esc = deps.escapeHtml;
  const eyebrowParts: string[] = [deps.typeLabel(e.type), deps.formatDateLong(e.date)];
  if (e.time) {
    const dur = parseInt(String(e.duration), 10) || 60;
    eyebrowParts.push(deps.formatEventRange(e.time, dur) || deps.formatEventTime(e.time));
  }

  // Credit block — shows creator + last editor. Suppresses the "Modifié par"
  // line when no edit ever happened after creation.
  let creditHtml = '';
  if (e.createdBy || e.updatedBy) {
    const created = e.createdBy
      ? `${deps.eventActorAvatarHTML(e.createdBy, 'cal-event-avatar-lg')} <span class="event-credit-text"><strong>${esc(e.createdBy.name || '—')}</strong>${e.createdAt ? ` <span class="event-credit-time">· ${deps.formatRelativeShort(e.createdAt)}</span>` : ''}</span>`
      : '';
    const editedDifferent = !!(e.updatedBy && e.updatedAt && e.updatedAt !== e.createdAt);
    const edited = editedDifferent
      ? `${deps.eventActorAvatarHTML(e.updatedBy, 'cal-event-avatar-lg')} <span class="event-credit-text"><strong>${esc(e.updatedBy?.name || '—')}</strong>${e.updatedAt ? ` <span class="event-credit-time">· ${deps.formatRelativeShort(e.updatedAt)}</span>` : ''}</span>`
      : '';
    creditHtml = `<div class="event-credit-block">
      ${created ? `<div class="event-credit-row"><span class="event-credit-label">Créé par</span><div class="event-credit-actor">${created}</div></div>` : ''}
      ${edited ? `<div class="event-credit-row"><span class="event-credit-label">Modifié par</span><div class="event-credit-actor">${edited}</div></div>` : ''}
    </div>`;
  }

  const durationOptions = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 360, 480];

  return `
    <div class="detail-hero">
      <div class="detail-eyebrow">${eyebrowParts.join(' · ')}</div>
      <div class="detail-title" contenteditable="true" onblur="updateEventField('${e.id}','title',this.innerText)">${esc(e.title)}</div>
      ${creditHtml}
      ${e.location || e.with ? `<div class="detail-meta-row">
        ${e.location ? `<div class="detail-meta-pill">📍 <strong>${esc(e.location)}</strong></div>` : ''}
        ${e.with ? `<div class="detail-meta-pill">👤 <strong>${esc(e.with)}</strong></div>` : ''}
      </div>` : ''}
    </div>

    <div class="detail-section">
      <h3>Informations</h3>
      <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 14px;">
        <div class="detail-field"><label>Date</label><input type="date" value="${e.date || ''}" onchange="updateEventField('${e.id}','date',this.value)" /></div>
        <div class="detail-field"><label>Heure</label><input type="time" value="${e.time || ''}" onchange="updateEventField('${e.id}','time',this.value)" /></div>
        <div class="detail-field"><label>Durée</label>
          <select onchange="updateEventField('${e.id}','duration',parseInt(this.value,10))">
            ${durationOptions.map((m) =>
              `<option value="${m}" ${(parseInt(String(e.duration), 10) || 60) === m ? 'selected' : ''}>${deps.formatDuration(m)}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="detail-field"><label>Type</label>
        <select onchange="updateEventField('${e.id}','type',this.value)">
          ${deps.eventTypes.map((t) => `<option value="${t}" ${e.type === t ? 'selected' : ''}>${deps.typeLabel(t)}</option>`).join('')}
        </select>
      </div>
      <div class="detail-field"><label>Lieu / Lien (Zoom, studio, hôtel...)</label><input value="${esc(e.location || '')}" onchange="updateEventField('${e.id}','location',this.value)" placeholder="Studio Noname, Zoom, etc." /></div>
      <div class="detail-field"><label>Avec (personnes)</label><input value="${esc(e.with || '')}" onchange="updateEventField('${e.id}','with',this.value)" placeholder="Degzzy, journaliste X, label Y..." /></div>
      <div class="detail-field"><label>Notes / Brief</label><textarea onblur="updateEventField('${e.id}','notes',this.value)" placeholder="Détails, ordre du jour, à préparer...">${esc(e.notes || '')}</textarea></div>
      <div class="detail-field"><label>Visibilité</label>
        <select onchange="updateEventField('${e.id}','visibility',this.value)">
          <option value="team" ${(e.visibility !== 'private') ? 'selected' : ''}>Équipe — visible par toute la team</option>
          <option value="private" ${(e.visibility === 'private') ? 'selected' : ''}>Privé — visible uniquement par moi</option>
        </select>
      </div>
    </div>

    ${ctx.relatedTrack ? `
    <div class="detail-section">
      <h3>Morceau lié</h3>
      <div class="detail-related">
        <div class="detail-related-card" onclick="openDetail('track','${ctx.relatedTrack.id}')">
          <div class="detail-related-label">Morceau</div>
          <div class="detail-related-title">${esc(ctx.relatedTrack.name)}</div>
        </div>
      </div>
    </div>` : ''}

    <div class="detail-section">
      <h3>Checklist suggérée pour ce type d'événement</h3>
      <div class="detail-checklist">
        ${deps.suggestChecklist(e.type).map((c) => `<div style="display:flex; gap:10px; align-items:center; font-size:13px; color: var(--text-soft);"><span style="width:6px; height:6px; background: var(--accent); border-radius:50%;"></span>${c}</div>`).join('')}
      </div>
    </div>

    <div class="detail-actions">
      <button class="btn btn-danger" onclick="deleteEventDetail('${e.id}')">Supprimer</button>
      <button class="btn btn-primary" data-detail-close>Fermer</button>
    </div>
  `;
}
