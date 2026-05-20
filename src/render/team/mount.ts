// ============================================================================
// Team render — DOM mounting. Phase TS-14D.
// ============================================================================

import { getState } from '../../data';
import type { TeamDeps, TeamMember, TeamModel } from './types';
import { buildTeamView } from './composition';

export interface TeamSideEffects {
  attachSwipeDelete?: (el: HTMLElement, onDelete: () => void) => void;
  swipeDeleteMember?: (id: string) => void;
}

let _fx: TeamSideEffects = {};

export function registerTeamSideEffects(hooks: TeamSideEffects): void {
  _fx = { ..._fx, ...hooks };
}

interface StateSlice {
  team?: TeamMember[];
}

export function renderTeamView(deps: TeamDeps): void {
  const state = getState() as StateSlice;
  const grid = document.getElementById('teamGrid');
  if (!grid) return;
  const model: TeamModel = { members: Array.isArray(state.team) ? state.team : [] };
  const result = buildTeamView(model, deps);
  grid.innerHTML = result.empty ? result.emptyHtml : result.listHtml;
  if (!result.empty && _fx.attachSwipeDelete && _fx.swipeDeleteMember) {
    grid.querySelectorAll<HTMLElement>('.list-row[data-id]').forEach((el) => {
      const id = el.dataset.id;
      if (id) _fx.attachSwipeDelete!(el, () => _fx.swipeDeleteMember!(id));
    });
  }
}
