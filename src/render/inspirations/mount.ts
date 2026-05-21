// ============================================================================
// Inspirations render — DOM mounting. Phase TS-14B.
// ONLY file in /src/render/inspirations/** that talks to the DOM.
// ============================================================================

import { getState } from '../../data';
import type { InspiDeps, InspiEntity, InspiFilterKey, InspiModel } from './types';
import { buildInspirationsView } from './composition';
import { viewTransition } from '../../features/mobile/transitions';

export interface InspirationsSideEffects {
  /** Async IDB blob URL accessor for legacy IDB-backed inspirations. */
  getInspiUrl?: (id: string) => Promise<string | null | undefined>;
}

let _fx: InspirationsSideEffects = {};

export function registerInspirationsSideEffects(hooks: InspirationsSideEffects): void {
  _fx = { ..._fx, ...hooks };
}

interface StateSlice {
  inspirations?: InspiEntity[];
  inspiFilter?: InspiFilterKey;
}

export function renderInspirationsView(deps: InspiDeps): void {
  const state = getState() as StateSlice;
  const model: InspiModel = {
    list: Array.isArray(state.inspirations) ? state.inspirations : [],
    filter: state.inspiFilter || 'all',
  };
  const result = buildInspirationsView(model, deps);

  // Filter chips
  const filterEl = document.getElementById('inspiFilter');
  if (filterEl) viewTransition(() => { filterEl.innerHTML = result.filterChipsHtml; });

  const grid = document.getElementById('inspiGrid') as HTMLElement | null;
  if (!grid) return;

  if (result.empty) {
    viewTransition(() => {
      grid.innerHTML = deps.emptyState(
        'inspirations',
        'Le mood board attend',
        'Image, vidéo, lien ou simple note — chaque référence nourrit le projet.',
        'Ajouter une inspiration',
        'openInspiLink()',
      );
    });
    grid.className = 'inspi-grid';
    return;
  }

  grid.className = 'inspi-grid inspi-grid-masonry';
  viewTransition(() => { grid.innerHTML = result.gridHtml; });

  // Hydrate IDB-backed media after mount — async, fire-and-forget.
  if (_fx.getInspiUrl) {
    const els = document.querySelectorAll<HTMLImageElement | HTMLVideoElement>('[data-hydrate-inspi]');
    els.forEach(async (el) => {
      const id = el.getAttribute('data-hydrate-inspi');
      if (!id) return;
      try {
        const url = await _fx.getInspiUrl!(id);
        if (url) (el as HTMLImageElement).src = url;
      } catch (_e) { /* no-op */ }
    });
  }
}
