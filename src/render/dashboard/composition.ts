// ============================================================================
// Dashboard render — composition. Phase TS-14A.
//
// PURE orchestration: takes the DashboardModel + DashboardDeps, runs the
// calculations, calls each widget, returns a DashboardViewResult.
// NO DOM, NO side-effects. The full pipeline is deterministic given the
// inputs (modulo wall-clock reads inside today.toLocaleDateString — same
// input today → same output).
// ============================================================================

import type { DashboardDeps, DashboardModel, DashboardViewResult } from './types';
import {
  upcomingEvents,
  todayEvents,
  dashboardTodos,
  urgentTodos,
  nextReleaseEvent,
  daysUntil,
} from './calculations';
import { buildGreeting } from './widgets/greeting';
import { buildHero } from './widgets/hero';
import { buildUrgent } from './widgets/urgent';
import { buildTodayAgenda } from './widgets/today';
import { buildUpcomingList } from './widgets/upcoming';
import { buildReleaseCard } from './widgets/release';
import { buildStats } from './widgets/stats';

export function buildDashboardView(model: DashboardModel, deps: DashboardDeps): DashboardViewResult {
  // Filter events through visibility ONCE (every downstream widget sees the
  // same role-respecting set — matches inline behavior).
  const visibleEvents = deps.filterVisibleEvents(model.events);
  const upcoming = upcomingEvents(visibleEvents, model.today, deps);
  const today = todayEvents(visibleEvents, model.today);
  const nextRelease = nextReleaseEvent(upcoming);
  const upcomingNonRelease = upcoming.filter((e) => e.type !== 'release');

  const allDashboardTodos = dashboardTodos(model.todos, model.roleKey, deps);
  const urgent = urgentTodos(allDashboardTodos, deps);

  const daysToProject = daysUntil(model.today, model.projectDate);

  const greeting = buildGreeting(model.profile, model.user);
  const hero = buildHero(model.today, daysToProject, model.phase, deps);
  const urgentWidget = buildUrgent(urgent, model.roleKey, model.role, deps);
  const todayWidget = buildTodayAgenda(today, deps);
  const upcomingWidget = buildUpcomingList(upcoming, deps);
  const releaseWidget = buildReleaseCard(nextRelease, model.today, deps);
  const statsWidget = buildStats(
    { dashboardTodos: allDashboardTodos, upcomingNonRelease, roleKey: model.roleKey },
    deps,
  );

  return {
    greetingName: greeting.name,
    greetingAvatarInitial: greeting.avatarInitial,
    greetingAlias: greeting.alias,
    heroEyebrow: hero.eyebrow,
    heroCount: hero.count,
    heroLabel: hero.label,
    heroPhaseHtml: hero.phaseHtml,
    urgentHidden: urgentWidget.hidden,
    urgentHtml: urgentWidget.html,
    todayMeta: todayWidget.meta,
    todayHtml: todayWidget.html,
    upcomingEmpty: upcomingWidget.empty,
    upcomingHtml: upcomingWidget.html,
    upcomingEmptyHtml: upcomingWidget.emptyHtml,
    releaseHidden: releaseWidget.hidden,
    releaseHtml: releaseWidget.html,
    releaseDataset: releaseWidget.dataset,
    releaseEventId: releaseWidget.eventId,
    cardsHtml: statsWidget.html,
  };
}
