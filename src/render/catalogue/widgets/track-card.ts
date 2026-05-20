// ============================================================================
// Catalogue widget — track card. Phase TS-15. PURE HTML.
// ============================================================================

import type { CatalogueDeps, CatalogueTrack } from '../types';

export function buildTrackCard(t: CatalogueTrack, deps: CatalogueDeps): string {
  const hasCover = !!(t.cover || t.idbCover);
  const coverInline = (t.cover && typeof t.cover === 'string' && t.cover.startsWith('data:'))
    ? t.cover
    : '';
  const dateStr = t.releaseDate ? deps.formatDate(t.releaseDate) : '—';
  const metaBits: string[] = [dateStr];
  if (t.duration) metaBits.push(t.duration);
  if (t.bpm) metaBits.push(t.bpm + ' BPM');
  return `
    <div class="track-card" data-id="${t.id}" onclick="openDetail('track','${t.id}')">
      <label class="track-cover ${hasCover ? 'has-image' : ''}" data-cover-for="${t.id}" onclick="event.stopPropagation()" style="${coverInline ? `background-image:url('${coverInline}')` : ''}">
        <span class="track-cover-hint">${hasCover ? '' : '+ Cover'}</span>
        <input type="file" accept="image/*" data-field="cover" data-id="${t.id}" />
      </label>
      <div class="track-body">
        <div class="track-head">
          <div class="track-name">${deps.escapeHtml(t.name)}</div>
          <div class="status-chip" data-status="${t.status}" onclick="event.stopPropagation(); cycleStatus('${t.id}')">${deps.statusLabel(t.status)}</div>
        </div>
        <div class="track-meta-line">${metaBits.join(' · ')}${t.feat ? ' · feat. ' + deps.escapeHtml(t.feat) : ''}</div>
        <div class="track-audio-slot" data-track-id="${t.id}" onclick="event.stopPropagation()">
          ${deps.trackAudioInitialHTML(t)}
        </div>
      </div>
    </div>
  `;
}
