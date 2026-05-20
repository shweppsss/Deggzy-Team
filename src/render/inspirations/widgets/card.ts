// ============================================================================
// Inspirations widget — single card. Phase TS-14B. PURE HTML.
// ============================================================================

import type { InspiDeps, InspiEntity } from '../types';
import { normalizeInspi } from '../calculations';

export function buildInspiCard(raw: InspiEntity, deps: InspiDeps): string {
  const it = normalizeInspi(raw, deps);
  const cat = deps.escapeHtml(it.category || 'Autre');
  const title = deps.escapeHtml(it.title || 'Sans titre');
  const notes = it.notes ? deps.escapeHtml(it.notes) : '';
  let mediaBlock = '';
  let cardKind: string = it._mediaType;

  if (it._mediaType === 'image') {
    const hydrateAttr = it._needsHydrate ? ` data-hydrate-inspi="${deps.escapeHtml(it.id)}"` : '';
    const src = it._needsHydrate ? '' : it._mediaUrl;
    mediaBlock = `<div class="inspi-card-media"><img src="${src}" alt="${title}" loading="lazy"${hydrateAttr} /></div>`;
  } else if (it._mediaType === 'video') {
    const hydrateAttr = it._needsHydrate ? ` data-hydrate-inspi="${deps.escapeHtml(it.id)}"` : '';
    const src = it._needsHydrate ? '' : it._mediaUrl;
    mediaBlock = `<div class="inspi-card-media"><video src="${src}" muted playsinline loop preload="metadata" onmouseenter="this.play()" onmouseleave="this.pause()"${hydrateAttr}></video><div class="inspi-card-video-badge">${deps.icon('play', 12)}</div></div>`;
  } else if (it._mediaType === 'embed' && it._mediaEmbed) {
    const aspect = it.aspect || (it.provider === 'spotify' ? '5/2' : '16/9');
    mediaBlock = `<div class="inspi-card-media inspi-card-media-embed" style="aspect-ratio:${aspect};">${it._mediaEmbed}</div>`;
  } else if (it._mediaType === 'embed' && it.provider === 'tiktok') {
    mediaBlock = `<div class="inspi-card-media inspi-card-media-link" style="aspect-ratio:9/16; background: linear-gradient(135deg, #25F4EE, #FE2C55);"><div class="inspi-card-link-glyph">${deps.icon('music', 32)}</div></div>`;
    cardKind = 'link';
  } else if (it._mediaType === 'link') {
    let host = it._mediaUrl;
    try {
      host = new URL(it._mediaUrl).hostname.replace(/^www\./, '');
    } catch (_e) { /* keep raw */ }
    mediaBlock = `<div class="inspi-card-media inspi-card-media-link"><div class="inspi-card-link-glyph">${deps.icon('link', 24)}</div><div class="inspi-card-link-host">${deps.escapeHtml(host)}</div></div>`;
  } else {
    // Note card
    mediaBlock = `<div class="inspi-card-note"><div class="inspi-card-note-glyph">"</div>${notes ? `<div class="inspi-card-note-text">${notes}</div>` : ''}</div>`;
  }

  return `
    <article class="inspi-card-v2" data-id="${deps.escapeHtml(it.id)}" data-kind="inspi" data-action="open" data-media="${cardKind}" tabindex="0" role="button" aria-label="${title}">
      ${mediaBlock}
      <div class="inspi-card-foot">
        <div class="inspi-card-title">${title}</div>
        <div class="inspi-card-meta"><span class="inspi-card-badge">${cat}</span></div>
      </div>
    </article>
  `;
}
