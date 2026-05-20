// ============================================================================
// Detail renderer — track kind. Phase TS-7.
// Pure function: (entity, deps, context) => string. No globals, no DOM.
// Also exports renderAudioInitial — the audio-slot skeleton helper used
// both by renderTrack and by hydrate.ts (intra-feature TS edge).
// ============================================================================

import type { RenderDeps } from './shared';

export interface TrackEntity {
  id: string;
  name?: string;
  status?: string;
  cover?: string | null;
  idbCover?: unknown;
  audio?: string | null;
  idbAudio?: unknown;
  releaseDate?: string;
  duration?: string;
  bpm?: string;
  key?: string;
  feat?: string;
  notes?: string;
  isrc?: string;
  publishing?: string;
}

export interface TrackRenderContext {
  /** Events whose title contains the track name (legacy heuristic). */
  relatedEvents: Array<{ id: string; type?: string; title?: string; date?: string; time?: string }>;
}

/**
 * Audio slot skeleton — used inline by renderTrack and on cold-load by
 * hydrate.ts (if the slot was not populated yet when the overlay opened).
 * Pure: no DOM, no state — just (track, deps) → string.
 */
export function renderAudioInitial(t: TrackEntity, deps: RenderDeps): string {
  if (
    (t.audio && typeof t.audio === 'string' && t.audio.startsWith('data:')) ||
    t.idbAudio
  ) {
    // Same Untitled-style pill as the catalogue, plus the per-track action
    // row (download / replace / remove) underneath. Hydrated later with
    // real duration + filename once the IDB blob is loaded.
    return (
      deps.trackAudioPillHTML(t) +
      `<div class="track-audio-meta" data-meta-for="${deps.escapeHtml(t.id)}" style="margin-top:10px;"></div>` +
      `<div class="track-audio-actions" data-actions-for="${deps.escapeHtml(t.id)}" style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;"></div>`
    );
  }
  return `<label class="detail-audio-empty">+ Charger l'audio (WAV / MP3 / FLAC)<input type="file" accept="audio/*,.wav,.mp3,.flac,.m4a,.aac,.ogg" style="display:none;" onchange="handleDetailAudio('${t.id}', event)" /></label>`;
}

export function renderTrack(t: TrackEntity, deps: RenderDeps, ctx: TrackRenderContext): string {
  const esc = deps.escapeHtml;
  const hasCover = !!(t.cover || t.idbCover);
  const coverInline =
    t.cover && typeof t.cover === 'string' && t.cover.startsWith('data:')
      ? t.cover
      : '';
  const heroMeta: string[] = [deps.statusLabel(t.status)];
  if (t.releaseDate) heroMeta.push(deps.formatDate(t.releaseDate));
  if (t.duration) heroMeta.push(t.duration);

  const statusOptions = ['single', 'projet', 'produit', 'mixe', 'masterise', 'sorti'];

  return `
    <div class="track-hero">
      <label class="track-hero-cover ${hasCover ? 'has-image' : ''}" data-cover-for-detail="${t.id}" style="${coverInline ? `background-image:url('${coverInline}')` : ''}">
        ${hasCover ? '' : '<span class="track-hero-cover-empty">+ Ajouter cover</span>'}
        <input type="file" accept="image/*" style="display:none;" onchange="handleDetailCover('${t.id}', event)" />
      </label>
      <h1 class="track-hero-title" contenteditable="true" onblur="updateTrackField('${t.id}','name',this.innerText.trim())">${esc(t.name)}</h1>
      <div class="track-hero-meta">${heroMeta.join(' · ')}</div>
    </div>

    <div class="track-player-section" id="detailAudioSlot-${t.id}">
      ${renderAudioInitial(t, deps)}
    </div>

    <div class="info-list">
      <div class="info-row">
        <div class="info-label">Date de sortie</div>
        <input type="date" class="info-value" value="${t.releaseDate || ''}" onchange="updateTrackField('${t.id}','releaseDate',this.value)" />
      </div>
      <div class="info-row">
        <div class="info-label">Statut</div>
        <select class="info-value" onchange="updateTrackField('${t.id}','status',this.value)">
          ${statusOptions.map((s) => `<option value="${s}" ${t.status === s ? 'selected' : ''}>${deps.statusLabel(s)}</option>`).join('')}
        </select>
      </div>
      <div class="info-row">
        <div class="info-label">BPM</div>
        <input class="info-value" placeholder="—" value="${t.bpm || ''}" onchange="updateTrackField('${t.id}','bpm',this.value)" />
      </div>
      <div class="info-row">
        <div class="info-label">Durée</div>
        <input class="info-value" placeholder="3:24" value="${t.duration || ''}" onchange="updateTrackField('${t.id}','duration',this.value)" />
      </div>
      <div class="info-row">
        <div class="info-label">Tonalité</div>
        <input class="info-value" placeholder="—" value="${t.key || ''}" onchange="updateTrackField('${t.id}','key',this.value)" />
      </div>
      <div class="info-row">
        <div class="info-label">Featuring</div>
        <input class="info-value" placeholder="—" value="${t.feat || ''}" onchange="updateTrackField('${t.id}','feat',this.value)" />
      </div>
    </div>

    <div class="detail-section">
      <h3>Notes</h3>
      <textarea class="track-notes-area" placeholder="Brief, intention, références..." onblur="updateTrackField('${t.id}','notes',this.value)">${esc(t.notes || '')}</textarea>
    </div>

    <div class="detail-section">
      <h3>Événements liés${ctx.relatedEvents.length ? ' · ' + ctx.relatedEvents.length : ''}</h3>
      ${ctx.relatedEvents.length ? `
        <div class="detail-related">
          ${ctx.relatedEvents.map((e) => `
            <div class="detail-related-card" onclick="openDetail('event','${e.id}')">
              <div class="detail-related-label">${deps.typeLabel(e.type)} · ${deps.formatDate(e.date)}${e.time ? ' · ' + deps.formatEventTime(e.time) : ''}</div>
              <div class="detail-related-title">${esc(e.title)}</div>
            </div>
          `).join('')}
        </div>
      ` : `<div style="font-size: 13px; color: var(--text-soft); margin-bottom: 10px;">Aucun événement pour l'instant.</div>`}
      <button class="btn" style="margin-top: 10px;" onclick="addEventForTrack('${t.id}')">+ Ajouter</button>
    </div>

    <details class="detail-collapsible">
      <summary>Plus d'infos · ISRC, Publishing</summary>
      <div class="info-list" style="margin: 12px 0 0;">
        <div class="info-row">
          <div class="info-label">ISRC</div>
          <input class="info-value" placeholder="FR-XXX-26-00001" value="${t.isrc || ''}" onchange="updateTrackField('${t.id}','isrc',this.value)" />
        </div>
        <div class="info-row">
          <div class="info-label">Publishing</div>
          <input class="info-value" placeholder="SACEM / autre" value="${t.publishing || ''}" onchange="updateTrackField('${t.id}','publishing',this.value)" />
        </div>
      </div>
    </details>

    <div class="detail-actions">
      <button class="btn btn-danger" onclick="deleteTrackDetail('${t.id}')">Supprimer</button>
      <button class="btn btn-primary" data-detail-close>Fermer</button>
    </div>
  `;
}
