// ============================================================================
// Team render — composition. Phase TS-14D. PURE.
// ============================================================================

import type { TeamDeps, TeamModel, TeamViewResult } from './types';
import { buildMemberRow } from './widgets/member-row';

export function buildTeamView(model: TeamModel, deps: TeamDeps): TeamViewResult {
  const team = Array.isArray(model.members) ? model.members : [];
  if (team.length === 0) {
    return {
      empty: true,
      emptyHtml: deps.emptyState(
        'team',
        "Aucun membre pour l'instant",
        "Ajoute le premier rôle de ton équipe pour démarrer la collaboration.",
        'Ajouter un membre',
        'addMember()',
      ),
      listHtml: '',
    };
  }
  const rows = team.map((m) => buildMemberRow(m, deps)).join('');
  const listHtml = `
    <div class="list-section">
      <div class="list-section-head">Équipe <span class="count">${team.length}</span></div>
      <div class="list-section-body">
        ${rows}
      </div>
    </div>
  `;
  return { empty: false, emptyHtml: '', listHtml };
}
