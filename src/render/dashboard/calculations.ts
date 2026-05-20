// ============================================================================
// Dashboard render — calculations. Phase TS-14A.
//
// PURE math / data filtering. NO DOM, NO state read.
// Deterministic given (model, deps).
// ============================================================================

import type {
  DashboardEvent,
  DashboardTodo,
  DashboardDeps,
} from './types';
import { parseIsoDate } from '../shared/dates';

/** Days remaining from today's local midnight to `targetDate` (whole days). */
export function daysUntil(today: Date, targetDate: Date): number {
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const targetMid = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  return Math.max(0, Math.round((targetMid.getTime() - todayMid.getTime()) / (1000 * 60 * 60 * 24)));
}

/** Upcoming events sorted ascending by date. Today + future only. */
export function upcomingEvents(events: DashboardEvent[], today: Date, deps: DashboardDeps): DashboardEvent[] {
  return events
    .filter((e) => e && deps.isFutureOrToday(e.date, new Date(today)))
    .sort((a, b) => {
      const da = deps.parseDate(a.date);
      const db = deps.parseDate(b.date);
      return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
    });
}

/** Today's events sorted by time (untimed at the end). */
export function todayEvents(events: DashboardEvent[], today: Date): DashboardEvent[] {
  const todayIso = today.toISOString().slice(0, 10);
  return events
    .filter((e) => e && e.date === todayIso)
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
}

/** All dashboard-eligible todos for a role (active, role-filtered). */
export function dashboardTodos(todos: DashboardTodo[], roleKey: string, deps: DashboardDeps): DashboardTodo[] {
  return (todos || []).filter((t) => t && !t.done && deps.isTodoOnDashboard(t, roleKey));
}

const PRIORITY_RANK: Record<string, number> = { critique: 0, urgent: 1, important: 2, normal: 3 };

/** The top-4 most urgent todos (critique/urgent only). */
export function urgentTodos(allDashboardTodos: DashboardTodo[], deps: DashboardDeps, limit = 4): DashboardTodo[] {
  return allDashboardTodos
    .filter((t) => {
      const p = deps.todoPriority(t);
      return p === 'critique' || p === 'urgent';
    })
    .sort((a, b) => {
      const pa = PRIORITY_RANK[deps.todoPriority(a)] ?? 9;
      const pb = PRIORITY_RANK[deps.todoPriority(b)] ?? 9;
      if (pa !== pb) return pa - pb;
      return (a.due || '9999').localeCompare(b.due || '9999');
    })
    .slice(0, limit);
}

/** Count of critique+urgent within a todo list (for the stats sub-line). */
export function priorityCount(todos: DashboardTodo[], deps: DashboardDeps): number {
  return todos.filter((t) => {
    const p = deps.todoPriority(t);
    return p === 'critique' || p === 'urgent';
  }).length;
}

/** Next release event from a sorted-upcoming list (first one with type='release'). */
export function nextReleaseEvent(upcoming: DashboardEvent[]): DashboardEvent | null {
  return upcoming.find((e) => e.type === 'release') || null;
}

// ---------------------------------------------------------------------------
// Release countdown helpers — pure, exported for the widget.
// ---------------------------------------------------------------------------

/** Days between today (local midnight) and an ISO date string. */
export function releaseDaysLeft(today: Date, isoDate: string | undefined): number | null {
  if (!isoDate) return null;
  const release = parseIsoDate(isoDate);
  if (!release || isNaN(release.getTime())) return null;
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const releaseMid = new Date(release.getFullYear(), release.getMonth(), release.getDate());
  return Math.round((releaseMid.getTime() - todayMid.getTime()) / (1000 * 60 * 60 * 24));
}

/** Urgency state key for the release countdown card. */
export function releaseState(daysLeft: number): 'today' | 'urgent' | 'imminent' | 'near' | 'approaching' | 'upcoming' {
  if (daysLeft <= 0) return 'today';
  if (daysLeft <= 2) return 'urgent';
  if (daysLeft <= 6) return 'imminent';
  if (daysLeft <= 14) return 'near';
  if (daysLeft <= 30) return 'approaching';
  return 'upcoming';
}

/** Microcopy line for the release card. */
export function releaseMicrocopy(daysLeft: number): string {
  if (daysLeft <= 0) return 'Release day';
  if (daysLeft === 1) return 'Demain';
  if (daysLeft === 2) return 'Après-demain';
  if (daysLeft <= 6) return 'Imminent';
  if (daysLeft <= 14) return 'Avant lancement';
  return 'À venir';
}

/** Strip the legacy "SORTIE —" prefix from a release event title. */
export function releaseTitle(title: string | undefined): string {
  if (!title) return '';
  return title.replace(/^SORTIE\s*[—–-]?\s*/i, '').trim() || title;
}

/** Long-form French date for the release card. */
export function formatReleaseDate(isoDate: string | undefined): string {
  if (!isoDate) return '';
  const d = parseIsoDate(isoDate);
  if (!d || isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
