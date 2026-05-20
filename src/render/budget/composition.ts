// ============================================================================
// Budget render — composition. Phase TS-15. PURE.
// ============================================================================

import type { BudgetDeps, BudgetModel, BudgetViewResult } from './types';
import { computeTotals, spendByCategory, txCountByCategory } from './calculations';
import { buildBudgetHero } from './widgets/hero';
import { buildBudgetCategories } from './widgets/categories';
import { buildBudgetTransactions } from './widgets/transactions';
import { buildBudgetSplits } from './widgets/splits';

export function buildBudgetView(model: BudgetModel, deps: BudgetDeps): BudgetViewResult {
  const totals = computeTotals(model.budget);
  const byCat = spendByCategory(model.budget, deps.categories);
  const countByCat = txCountByCategory(model.budget);
  const txs = Array.isArray(model.budget.transactions) ? model.budget.transactions : [];
  return {
    heroHtml: buildBudgetHero(totals),
    catsHtml: buildBudgetCategories(deps.categories, byCat, countByCat, totals.spent),
    txHtml: buildBudgetTransactions(txs, deps.categories),
    splitsHtml: buildBudgetSplits(model.tracks, deps),
  };
}
