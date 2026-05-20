// ============================================================================
// Budget render — barrel. Phase TS-15.
// ============================================================================
export type {
  BudgetTransaction, BudgetState, SplitContrib, BudgetTrack,
  BudgetModel, BudgetViewResult, BudgetDeps,
} from './types';
export {
  computeTotals, spendByCategory, txCountByCategory, splitTotal, isEmpty,
} from './calculations';
export { buildBudgetHero } from './widgets/hero';
export { buildBudgetCategories } from './widgets/categories';
export { buildBudgetTransactions } from './widgets/transactions';
export { buildBudgetSplits } from './widgets/splits';
export { buildBudgetView } from './composition';
export { renderBudgetView } from './mount';
