// ============================================================================
// Video-section render — DOM mounting. Phase TS-14C.
// Used by BOTH clips and capsules (TS-14D).
// ============================================================================

import { getState } from '../../data';
import type { VideoDeps, VideoItem, VideoModel, VideoSectionKind } from './types';
import { VIDEO_CONFIGS } from './types';
import { buildVideoSectionView } from './composition';
import { viewTransition } from '../../features/mobile/transitions';

export interface VideoSectionSideEffects {
  /** Hydrate <video> elements after mount — fills `src` from IDB blob URLs. */
  hydrateVideoSection?: (kind: VideoSectionKind) => Promise<void> | void;
}

let _fx: VideoSectionSideEffects = {};

export function registerVideoSectionSideEffects(hooks: VideoSectionSideEffects): void {
  _fx = { ..._fx, ...hooks };
}

export function renderVideoSectionView(kind: VideoSectionKind, deps: VideoDeps): void {
  const cfg = VIDEO_CONFIGS[kind];
  const grid = document.getElementById(cfg.gridId);
  if (!grid) return;
  const state = getState() as Record<string, unknown>;
  const items = Array.isArray(state[cfg.stateKey]) ? (state[cfg.stateKey] as VideoItem[]) : [];
  const model: VideoModel = { kind, items };
  const result = buildVideoSectionView(model, deps);
  if (result.empty) {
    viewTransition(() => { grid.innerHTML = result.emptyHtml; });
    return;
  }
  viewTransition(() => { grid.innerHTML = result.gridHtml; });
  if (_fx.hydrateVideoSection) {
    try { Promise.resolve(_fx.hydrateVideoSection(kind)).catch(() => {}); } catch (_e) { /* no-op */ }
  }
}
