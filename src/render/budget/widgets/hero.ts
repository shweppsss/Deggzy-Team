// ============================================================================
// Budget widget — hero (totals + bar). Phase TS-15. PURE HTML.
// ============================================================================

import type { BudgetTotals } from '../calculations';

export function buildBudgetHero(t: BudgetTotals): string {
  return `
    <div class="budget-stat-big">
      <div class="budget-stat-label">Budget total</div>
      <div class="budget-stat-value"><input value="${t.total}" onchange="updateBudgetTotal(this.value)" /> €</div>
    </div>
    <div class="budget-stat-big">
      <div class="budget-stat-label">Dépensé</div>
      <div class="budget-stat-value danger">${t.spent.toLocaleString('fr-FR')} €</div>
    </div>
    <div class="budget-stat-big">
      <div class="budget-stat-label">Restant</div>
      <div class="budget-stat-value ${t.remaining < 0 ? 'danger' : 'success'}">${t.remaining.toLocaleString('fr-FR')} €</div>
    </div>
    <div class="budget-bar"><div class="budget-bar-fill ${t.spent > t.total ? 'over' : ''}" style="width: ${t.pct}%"></div></div>
  `;
}
