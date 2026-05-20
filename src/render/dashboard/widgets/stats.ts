// ============================================================================
// Dashboard widget — stats strip. Phase TS-14A. PURE HTML.
// ============================================================================

import type { DashboardDeps, DashboardEvent, DashboardTodo } from '../types';
import { priorityCount } from '../calculations';

export interface StatsResult {
  html: string;
}

export interface StatsInputs {
  /** All role-filtered active todos (drives the "Tâches actives" tile). */
  dashboardTodos: DashboardTodo[];
  /** Upcoming events EXCLUDING releases (drives the "Rendez-vous à venir" tile). */
  upcomingNonRelease: DashboardEvent[];
  /** Active role key — switches the first tile's label between "Tes tâches" / "Tâches". */
  roleKey: string;
}

export function buildStats(inputs: StatsInputs, deps: DashboardDeps): StatsResult {
  const { dashboardTodos, upcomingNonRelease, roleKey } = inputs;
  const scoped = roleKey !== 'autre' && roleKey !== 'manager';
  const prioCount = priorityCount(dashboardTodos, deps);
  const upcomingFirst = upcomingNonRelease[0];

  const tiles = [
    {
      label: scoped ? 'Tes tâches actives' : 'Tâches actives',
      value: dashboardTodos.length,
      sub: `${prioCount} en priorité`,
      onclick: `activate('todos')`,
    },
    {
      label: 'Rendez-vous à venir',
      value: upcomingNonRelease.length,
      sub: upcomingFirst ? 'Prochain · ' + deps.formatDate(upcomingFirst.date) : 'Rien de prévu',
      onclick: `activate('calendrier')`,
    },
  ];

  const html = tiles.map((s) => `
      <div class="dash-stat" onclick="${s.onclick}">
        <div class="dash-stat-label">${s.label}</div>
        <div class="dash-stat-value">${s.value}</div>
        <div class="dash-stat-sub">${s.sub}</div>
      </div>
    `).join('');

  return { html };
}
