// ============================================================================
// Catalogue render — DOM mounting. Phase TS-15.
// ============================================================================

import { getState } from '../../data';
import type { CatalogueDeps, CatalogueModel, CatalogueTrack } from './types';
import { buildCatalogueView } from './composition';
import { viewTransition } from '../../features/mobile/transitions';

export interface CatalogueSideEffects {
  attachTrackEvents?: (id: string) => void;
  attachSwipeDelete?: (el: HTMLElement, onDelete: () => void) => void;
  swipeDeleteTrack?: (id: string) => void;
  hydrateAllAudios?: () => Promise<void> | void;
  hydrateAllCovers?: () => Promise<void> | void;
}

let _fx: CatalogueSideEffects = {};

export function registerCatalogueSideEffects(hooks: CatalogueSideEffects): void {
  _fx = { ..._fx, ...hooks };
}

interface StateSlice {
  tracks?: CatalogueTrack[];
}

export function renderCatalogueView(deps: CatalogueDeps): void {
  const grid = document.getElementById('tracksGrid');
  if (!grid) return;
  const state = getState() as StateSlice;
  const model: CatalogueModel = { tracks: Array.isArray(state.tracks) ? state.tracks : [] };
  const result = buildCatalogueView(model, deps);
  viewTransition(() => { grid.innerHTML = result.gridHtml; });
  // Re-attach per-card event listeners + swipe handlers.
  model.tracks.forEach((t) => {
    if (_fx.attachTrackEvents) {
      try { _fx.attachTrackEvents(t.id); } catch (e) { console.warn('attachTrackEvents:', e); }
    }
    if (_fx.attachSwipeDelete && _fx.swipeDeleteTrack) {
      const card = grid.querySelector<HTMLElement>(`.track-card[data-id="${t.id}"]`);
      if (card) {
        const id = t.id;
        _fx.attachSwipeDelete(card, () => _fx.swipeDeleteTrack!(id));
      }
    }
  });
  // Hydrate IDB-backed audio + cover blobs (async).
  if (_fx.hydrateAllAudios) {
    try { Promise.resolve(_fx.hydrateAllAudios()).catch(() => {}); } catch (_e) { /* no-op */ }
  }
  if (_fx.hydrateAllCovers) {
    try { Promise.resolve(_fx.hydrateAllCovers()).catch(() => {}); } catch (_e) { /* no-op */ }
  }
}
