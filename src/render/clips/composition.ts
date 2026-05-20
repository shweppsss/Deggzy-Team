// ============================================================================
// Video-section render — composition. Phase TS-14C. PURE.
// ============================================================================

import type { VideoDeps, VideoModel, VideoViewResult } from './types';
import { VIDEO_CONFIGS } from './types';
import { sortByAddedAtDesc, emptyTitle, emptyHint } from './calculations';
import { buildVideoCard } from './widgets/video-card';

export function buildVideoSectionView(model: VideoModel, deps: VideoDeps): VideoViewResult {
  const cfg = VIDEO_CONFIGS[model.kind];
  const items = Array.isArray(model.items) ? model.items : [];
  const hydrateSelector = `[data-hydrate-video^="${model.kind}:"]`;
  if (items.length === 0) {
    return {
      empty: true,
      emptyHtml: deps.emptyState(
        'inspirations',
        emptyTitle(model.kind),
        emptyHint(model.kind),
        'Ajouter un ' + cfg.label,
        `document.getElementById('${cfg.uploadInputId}').click()`,
      ),
      gridHtml: '',
      hydrateSelector,
    };
  }
  const sorted = sortByAddedAtDesc(items);
  const gridHtml = sorted.map((item) => buildVideoCard(model.kind, item, deps)).join('');
  return { empty: false, emptyHtml: '', gridHtml, hydrateSelector };
}
