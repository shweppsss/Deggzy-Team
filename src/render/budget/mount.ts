// ============================================================================
// Budget render — DOM mounting. Phase TS-15.
// ============================================================================

import { getState } from '../../data';
import type { BudgetDeps, BudgetModel, BudgetState, BudgetTrack } from './types';
import { buildBudgetView } from './composition';
import { viewTransition } from '../../features/mobile/transitions';

interface StateSlice {
  budget?: BudgetState;
  tracks?: BudgetTrack[];
}

export function renderBudgetView(deps: BudgetDeps): void {
  const state = getState() as StateSlice;
  const model: BudgetModel = {
    budget: state.budget || {},
    tracks: Array.isArray(state.tracks) ? state.tracks : [],
  };
  const result = buildBudgetView(model, deps);
  const hero = document.getElementById('budgetHero');
  if (hero) viewTransition(() => { hero.innerHTML = result.heroHtml; });
  const cats = document.getElementById('budgetCats');
  if (cats) viewTransition(() => { cats.innerHTML = result.catsHtml; });
  const txList = document.getElementById('txList');
  if (txList) viewTransition(() => { txList.innerHTML = result.txHtml; });
  const splits = document.getElementById('splitsTable');
  if (splits) viewTransition(() => { splits.innerHTML = result.splitsHtml; });
}
