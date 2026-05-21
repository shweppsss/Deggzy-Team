// ============================================================================
// DOM hydration — wire the rendered pill slots/covers to their resolved URLs.
// Phase TS-18.
//
// The catalogue render pass produces empty slots (`.track-audio-slot`,
// `.track-cover[data-cover-for]`). After mount, these hydrate functions
// fill them based on the cache state. Idempotent: re-running on the same
// DOM is a no-op besides re-running the duration probe.
// ============================================================================

import type { AudioCacheDeps } from './types';
import { getTrackAudioUrl, getTrackCoverUrl } from './urls';
import { viewTransition } from '../../mobile/transitions';

let _deps: AudioCacheDeps | null = null;

export function registerHydrateDeps(deps: AudioCacheDeps): void {
  _deps = deps;
}

/** Resolve all tracks that should have a cover, attach it to the matching slot. */
export async function hydrateAllCovers(): Promise<void> {
  if (!_deps) return;
  for (const t of _deps.getTracks()) {
    if (t.idbCover) {
      const url = await getTrackCoverUrl(t.id);
      const el = document.querySelector<HTMLElement>(`.track-cover[data-cover-for="${t.id}"]`);
      if (el && url) {
        el.style.backgroundImage = `url('${url}')`;
      }
    }
  }
}

/**
 * Resolve all tracks that should have audio. For each:
 *  - If no audio resolves (cache miss + cloud miss), reset the pill slot to
 *    the empty-state HTML so the user can re-attach an audio file.
 *  - If audio resolves, fill the `[data-meta-for]` element with name + size,
 *    and probe duration for inactive tracks (the active track's label is
 *    owned by the audio store).
 */
export async function hydrateAllAudios(): Promise<void> {
  if (!_deps) return;
  for (const t of _deps.getTracks()) {
    const hasIdb = !!t.idbAudio;
    const hasDataUrl = !!(t.audio && typeof t.audio === 'string' && t.audio.startsWith('data:'));
    if (!hasIdb && !hasDataUrl) continue;
    const data = await getTrackAudioUrl(t.id);
    const slot = document.querySelector<HTMLElement>(`.track-audio-slot[data-track-id="${t.id}"]`);
    if (!slot) continue;
    if (!data) {
      viewTransition(() => { slot.innerHTML = _deps!.trackAudioInitialHTML({ id: t.id }); });
      continue;
    }
    const meta = slot.querySelector<HTMLElement>(`[data-meta-for="${t.id}"]`);
    if (meta) meta.textContent = data.name + ' · ' + _deps.formatBytes(data.size);
    // Duration probe for INACTIVE tracks only — the active track's label
    // is driven by the audio store via _syncAllPills.
    try {
      const probe = new Audio();
      probe.preload = 'metadata';
      probe.src = data.url;
      probe.addEventListener('loadedmetadata', () => {
        if (!_deps) return;
        if (_deps.getActiveTrackId() === t.id) return;
        const pillTime = document.querySelector<HTMLElement>(`.track-audio[data-track-id="${t.id}"] .track-audio-time`);
        if (pillTime) pillTime.textContent = _deps.formatAudioTime(probe.duration);
      }, { once: true });
    } catch { /* probe creation failed — non-fatal */ }
  }
}
