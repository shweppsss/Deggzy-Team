// ============================================================================
// Dashboard render — barrel. Phase TS-14A.
// ============================================================================

export type {
  DashboardEvent,
  DashboardTodo,
  DashboardProfile,
  DashboardUser,
  DashboardPhase,
  DashboardRole,
  DashboardModel,
  DashboardViewResult,
  DashboardDeps,
} from './types';

export {
  daysUntil,
  upcomingEvents,
  todayEvents,
  dashboardTodos,
  urgentTodos,
  priorityCount,
  nextReleaseEvent,
  releaseDaysLeft,
  releaseState,
  releaseMicrocopy,
  releaseTitle,
  formatReleaseDate,
} from './calculations';

export { buildGreeting } from './widgets/greeting';
export { buildHero } from './widgets/hero';
export { buildUrgent } from './widgets/urgent';
export { buildTodayAgenda } from './widgets/today';
export { buildUpcomingList } from './widgets/upcoming';
export { buildReleaseCard } from './widgets/release';
export { buildStats } from './widgets/stats';

export { buildDashboardView } from './composition';

export {
  renderDashboardView,
  registerDashboardSideEffects,
  registerDashboardModelBuilder,
  type DashboardSideEffects,
  type DashboardModelInputs,
  type DashboardModelExtras,
} from './mount';
