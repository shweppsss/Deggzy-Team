// ============================================================================
// Team render — barrel. Phase TS-14D.
// ============================================================================
export type { TeamMember, TeamModel, TeamViewResult, TeamDeps } from './types';
export { isPendingMember, memberInitials } from './calculations';
export { buildMemberRow } from './widgets/member-row';
export { buildTeamView } from './composition';
export {
  renderTeamView, registerTeamSideEffects, type TeamSideEffects,
} from './mount';
