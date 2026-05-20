// ============================================================================
// Todos widget — section header + body wrapper. Phase TS-14B. PURE HTML.
// ============================================================================

import { escapeHtml } from '../../../lib/format-utils';

export function buildSection(label: string, undoneCount: number, totalCount: number, itemsHtml: string): string {
  return `
        <div class="list-section">
          <div class="list-section-head">${escapeHtml(label)} <span class="count">${undoneCount} / ${totalCount}</span></div>
          <div class="list-section-body">${itemsHtml}</div>
        </div>
      `;
}
