// ============================================================================
// Budget widget — categories breakdown. Phase TS-15. PURE HTML.
// ============================================================================

import { escapeHtml } from '../../../lib/format-utils';

export function buildBudgetCategories(
  categories: ReadonlyArray<string>,
  byCat: Record<string, number>,
  countByCat: Record<string, number>,
  spent: number,
): string {
  return categories.map((c) => {
    const v = byCat[c] || 0;
    const p = spent > 0 ? (v / spent) * 100 : 0;
    const count = countByCat[c] || 0;
    return `
      <div class="budget-cat">
        <div class="budget-cat-name">${escapeHtml(c)}</div>
        <div class="budget-cat-value">${v.toLocaleString('fr-FR')} €</div>
        <div class="budget-cat-bar"><div class="budget-cat-bar-fill" style="width:${p}%"></div></div>
        <div class="budget-cat-meta"><span>${Math.round(p)}% des dépenses</span><span>${count} entrée(s)</span></div>
      </div>
    `;
  }).join('');
}
