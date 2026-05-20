// ============================================================================
// Detail overlay — post-render hydrate effects. Phase TS-6.
//
// Async hydrate functions that run AFTER detailBody.innerHTML is set.
// They fetch URLs from IDB (cover / audio) and inject them into placeholder
// elements rendered by the inline HTML helpers.
//
// DEPENDENCIES (still legacy inline — accessed via typed window accessors):
//   - state.tracks            global app state
//   - getTrackCoverUrl(id)    async IDB blob URL accessor
//   - getTrackAudioUrl(id)    async IDB blob URL accessor
//   - escapeHtml              HTML-escape helper
//   - formatBytes             humanize byte sizes
//   - _formatAudioTime        humanize duration
//
// TS-7: `detailAudioInitialHTML` is replaced by `renderAudioInitial` from
// `./render/track` — an intra-feature TS import. The legacy inline helper
// is gone.
//
// All other accesses use `typeof` guards so the module degrades silently
// when a dependency isn't yet defined.
// ============================================================================

import { renderAudioInitial, getRenderDeps, type TrackEntity } from './render';

interface AudioData {
  url: string;
  name: string;
  size: number;
}

interface StateLike {
  tracks?: TrackEntity[];
}

type Win = Window & {
  state?: StateLike;
  getTrackCoverUrl?: (id: string) => Promise<string | null | undefined>;
  getTrackAudioUrl?: (id: string) => Promise<AudioData | null | undefined>;
  escapeHtml?: (s: string) => string;
  formatBytes?: (n: number) => string;
  _formatAudioTime?: (s: number) => string;
};

function w(): Win {
  return window as unknown as Win;
}

function findTrack(trackId: string): TrackEntity | undefined {
  const tracks = w().state?.tracks;
  if (!Array.isArray(tracks)) return undefined;
  return tracks.find((x) => x.id === trackId);
}

export async function hydrateDetailCover(trackId: string): Promise<void> {
  const t = findTrack(trackId);
  if (!t || !t.idbCover) return;
  const getCover = w().getTrackCoverUrl;
  if (typeof getCover !== 'function') return;
  const url = await getCover(trackId);
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
  const getAudio = w().getTrackAudioUrl;
  if (typeof getAudio !== 'function') return;
  const data = await getAudio(trackId);
  const slot = document.getElementById('detailAudioSlot-' + trackId);
  if (!slot) return;

  // Re-use the typed audio-slot renderer (TS-7) for the skeleton. Pure,
  // no globals — takes a track + deps and returns string HTML.
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
  const fmtBytes = w().formatBytes;
  if (meta && typeof fmtBytes === 'function') {
    meta.textContent = data.name + ' · ' + fmtBytes(data.size);
  }
  const actions = slot.querySelector(`[data-actions-for="${trackId}"]`);
  const esc = w().escapeHtml;
  if (actions && typeof esc === 'function') {
    actions.innerHTML = `
      <a class="btn btn-sm" href="${data.url}" download="${esc(data.name)}">↓ Télécharger</a>
      <button class="btn btn-sm" onclick="clearAudio('${trackId}'); openDetail('track','${trackId}');" type="button">Retirer</button>
      <label class="btn btn-sm" style="cursor:pointer;">Remplacer<input type="file" accept="audio/*,.wav,.mp3,.flac,.m4a,.aac,.ogg" style="display:none;" onchange="handleDetailAudio('${trackId}', event)" /></label>
    `;
  }
  // Duration probe — same trick the catalogue uses.
  try {
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.src = data.url;
    const fmtTime = w()._formatAudioTime;
    probe.addEventListener(
      'loadedmetadata',
      () => {
        const pill = slot.querySelector('.track-audio-time');
        if (pill && typeof fmtTime === 'function') {
          pill.textContent = fmtTime(probe.duration);
        }
      },
      { once: true },
    );
  } catch (_e) {
    /* no-op */
  }
}
