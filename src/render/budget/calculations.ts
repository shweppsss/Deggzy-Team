// ============================================================================
// Budget render — calculations. Phase TS-15. PURE.
// ============================================================================

import type { BudgetState } from './types';

export interface BudgetTotals {
  total: number;
  spent: number;
  remaining: number;
  pct: number;
}

export function computeTotals(b: BudgetState): BudgetTotals {
  const total = Number(b.total) || 0;
  const txs = Array.isArray(b.transactions) ? b.transactions : [];
  const spent = txs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const remaining = total - spent;
  const pct = total > 0 ? Math.min(100, (spent / total) * 100) : 0;
  return { total, spent, remaining, pct };
}

export function spendByCategory(b: BudgetState, categories: ReadonlyArray<string>): Record<string, number> {
  const byCat: Record<string, number> = {};
  categories.forEach((c) => { byCat[c] = 0; });
  const txs = Array.isArray(b.transactions) ? b.transactions : [];
  txs.forEach((t) => {
    const cat = t.cat || '';
    byCat[cat] = (byCat[cat] || 0) + (Number(t.amount) || 0);
  });
  return byCat;
}

export function txCountByCategory(b: BudgetState): Record<string, number> {
  const out: Record<string, number> = {};
  const txs = Array.isArray(b.transactions) ? b.transactions : [];
  txs.forEach((t) => {
    const cat = t.cat || '';
    out[cat] = (out[cat] || 0) + 1;
  });
  return out;
}

export function splitTotal(arr: ReadonlyArray<{ pct?: number | string }>): number {
  return arr.reduce((s, c) => s + (Number(c.pct) || 0), 0);
}

export function isEmpty(b: BudgetState): boolean {
  const txs = Array.isArray(b.transactions) ? b.transactions : [];
  return txs.length === 0;
}

// BudgetTransaction is imported for type narrowing inside the helpers
// above; nothing to do here at runtime.
