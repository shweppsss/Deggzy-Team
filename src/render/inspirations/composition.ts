// ============================================================================
// Inspirations render — composition. Phase TS-14B. PURE.
// ============================================================================

import type { InspiDeps, InspiModel, InspiViewResult } from './types';
import { applyFilter, sortByAddedAtDesc } from './calculations';
import { buildInspiFilterChips } from './widgets/filter-chips';
import { buildInspiCard } from './widgets/card';

export function buildInspirationsView(model: InspiModel, deps: InspiDeps): InspiViewResult {
  const list = Array.isArray(model.list) ? model.list : [];
  const filterChipsHtml = buildInspiFilterChips(list, model.filter, deps);
  const visible = applyFilter(list, model.filter);
  if (visible.length === 0) {
    return { filterChipsHtml, empty: true, gridHtml: '' };
  }
  const sorted = sortByAddedAtDesc(visible);
  const gridHtml = sorted.map((it) => buildInspiCard(it, deps)).join('');
  return { filterChipsHtml, empty: false, gridHtml };
}
