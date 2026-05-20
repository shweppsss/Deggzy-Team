// ============================================================================
// Detail overlay — post-render hydrate effects. Phase TS-6, TS-7, TS-8.
//
// Async hydrate functions that run AFTER detailBody.innerHTML is set.
// They fetch URLs from IDB (cover / audio) and inject them into placeholder
// elements rendered by the typed renderers.
//
// TS-8: no more `window.X` reads inside this file. All legacy access
// goes through `/src/lib/legacy-bridge` (the single allowed bridge point
// for not-yet-migrated helpers). `escapeHtml` is now a real TS import.
// `renderAudioInitial` is an intra-feature TS import from `./render/track`.
// ============================================================================

import { escapeHtml } from '../../lib/format-utils';
import {
  getLegacyState,
  fetchTrackCoverUrl,
  fetchTrackAudioUrl,
  formatBytes,
  formatAudioTime,
} from '../../lib/legacy-bridge';
import { renderAudioInitial, getRenderDeps, type TrackEntity } from './render';

function findTrack(trackId: string): TrackEntity | undefined {
  const tracks = getLegacyState().tracks;
  if (!Array.isArray(tracks)) return undefined;
  return tracks.find((x) => x.id === trackId) as TrackEntity | undefined;
}

export async function hydrateDetailCover(trackId: string): Promise<void> {
  const t = findTrack(trackId);
  if (!t || !t.idbCover) return;
  const url = await fetchTrackCoverUrl(trackId);
  const el = document.querySelector<HTMLElement>(`[data-cover-for-detail="${trackId}"]`);
  if (el && url) {
    el.style.backgroundImage = `url('${url}')`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.style.display = 'block';
  }
}

export async function hydrateDetailAudio(trackId: string): Promise<void> {
  const t = findTrack(trackId);
  if (!t) return;
  // Same guard as inline: only hydrate if the track has IDB audio or a data: URI.
  const hasIdb = !!t.idbAudio;
  const hasDataUri = typeof t.audio === 'string' && t.audio.startsWith('data:');
  if (!hasIdb && !hasDataUri) return;
  const data = await fetchTrackAudioUrl(trackId);
  const slot = document.getElementById('detailAudioSlot-' + trackId);
  if (!slot) return;

  // Re-use the typed audio-slot renderer (TS-7) for the skeleton.
  const deps = getRenderDeps();
  if (!data) {
    slot.innerHTML = renderAudioInitial({ id: trackId }, deps);
    return;
  }
  // Make sure the pill skeleton is present (first open may render before
  // hydrate finishes if openDetail was navigated to from a cold load).
  if (!slot.querySelector('.track-audio')) {
    slot.innerHTML = renderAudioInitial(t, deps);
  }
  const meta = slot.querySelector(`[data-meta-for="${trackId}"]`);
  if (meta) {
    meta.textContent = data.name + ' · ' + formatBytes(data.size);
  }
  const actions = slot.querySelector(`[data-actions-for="${trackId}"]`);
  if (actions) {
    actions.innerHTML = `
      <a class="btn btn-sm" href="${data.url}" download="${escapeHtml(data.name)}">↓ Télécharger</a>
      <button class="btn btn-sm" onclick="clearAudio('${trackId}'); openDetail('track','${trackId}');" type="button">Retirer</button>
      <label class="btn btn-sm" style="cursor:pointer;">Remplacer<input type="file" accept="audio/*,.wav,.mp3,.flac,.m4a,.aac,.ogg" style="display:none;" onchange="handleDetailAudio('${trackId}', event)" /></label>
    `;
  }
  // Duration probe — same trick the catalogue uses.
  try {
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.src = data.url;
    probe.addEventListener(
      'loadedmetadata',
      () => {
        const pill = slot.querySelector('.track-audio-time');
        if (pill) {
          pill.textContent = formatAudioTime(probe.duration);
        }
      },
      { once: true },
    );
  } catch (_e) {
    /* no-op */
  }
}
