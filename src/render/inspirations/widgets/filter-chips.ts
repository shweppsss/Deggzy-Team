// ============================================================================
// Inspirations widget — filter chips. Phase TS-14B. PURE HTML.
// ============================================================================

import type { InspiDeps, InspiEntity, InspiFilterKey } from '../types';
import { countByCategory } from '../calculations';

export function buildInspiFilterChips(list: InspiEntity[], activeFilter: InspiFilterKey, deps: InspiDeps): string {
  const filters: InspiFilterKey[] = ['all', ...deps.categories];
  return filters.map((f) => {
    const label = f === 'all' ? 'Toutes' : f;
    const count = countByCategory(list, f);
    return `<div class="todo-filter-chip ${activeFilter === f ? 'active' : ''}" onclick="setInspiFilter('${deps.escapeHtml(f)}')">${deps.escapeHtml(label)} <span style="opacity:.6">· ${count}</span></div>`;
  }).join('');
}
