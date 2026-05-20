// ============================================================================
// Video-section widget — single card. Phase TS-14C. PURE HTML.
// ============================================================================

import type { VideoDeps, VideoItem, VideoSectionKind } from '../types';

export function buildVideoCard(kind: VideoSectionKind, item: VideoItem, deps: VideoDeps): string {
  const title = deps.escapeHtml(item.title || 'Sans titre');
  const safeId = deps.escapeHtml(item.id);
  const dateLabel = item.addedAt
    ? new Date(item.addedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    : '';
  return `
    <article class="inspi-card-v2" data-id="${safeId}" data-kind="${kind}" data-media="video" tabindex="0" aria-label="${title}">
      <div class="inspi-card-media">
        <video data-hydrate-video="${kind}:${safeId}" muted playsinline loop preload="metadata"
               onmouseenter="this.play()" onmouseleave="this.pause()"></video>
        <div class="inspi-card-video-badge">${deps.icon('play', 12)}</div>
      </div>
      <div class="inspi-card-foot">
        <div class="inspi-card-title">${title}</div>
        <div class="inspi-card-meta">
          <span class="inspi-card-badge">${dateLabel}</span>
          <button class="btn btn-sm" onclick="event.stopPropagation(); deleteVideo('${kind}', '${safeId}')" aria-label="Supprimer" style="margin-left:auto;">×</button>
        </div>
      </div>
    </article>
  `;
}
