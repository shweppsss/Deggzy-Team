// ============================================================================
// Budget render — types. Phase TS-15.
// ============================================================================

export interface BudgetTransaction {
  id: string;
  date?: string;
  label?: string;
  cat?: string;
  amount?: number | string;
}

export interface BudgetState {
  total?: number | string;
  transactions?: BudgetTransaction[];
}

export interface SplitContrib {
  id: string;
  name?: string;
  role?: string;
  pct?: number | string;
}

export interface BudgetTrack {
  id: string;
  name?: string;
}

export interface BudgetModel {
  budget: BudgetState;
  tracks: BudgetTrack[];
}

export interface BudgetViewResult {
  heroHtml: string;
  catsHtml: string;
  txHtml: string;
  splitsHtml: string;
}

export interface BudgetDeps {
  categories: ReadonlyArray<string>;
  splitRoles: ReadonlyArray<string>;
  /** Get the splits array for a given track id (legacy `getSplitsArray`). */
  getSplitsForTrack: (trackId: string) => SplitContrib[];
}
