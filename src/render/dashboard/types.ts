// ============================================================================
// Dashboard render — types. Phase TS-14A.
//
// All renderers in this domain operate on three categories:
//   - INPUT entities (events, todos, profile, user)
//   - CONTEXT (today date, project date, role key, phase)
//   - DEPS (legacy helpers — injected by main.ts, never read from window)
//
// The deps interface is the ONLY surface where the dashboard module
// reaches into legacy code. No `window.X` access anywhere under
// /src/render/dashboard/**.
// ============================================================================

export interface DashboardEvent {
  id: string;
  title?: string;
  date?: string;
  time?: string;
  duration?: number | string;
  type?: string;
  location?: string;
  with?: string;
  visibility?: string;
  createdBy?: unknown;
  [key: string]: unknown;
}

export interface DashboardTodo {
  id: string;
  text?: string;
  done?: boolean;
  priority?: string;
  urgent?: boolean;
  due?: string;
  cat?: string;
  [key: string]: unknown;
}

export interface DashboardProfile {
  name?: string;
  alias?: string | null;
  role?: string;
}

export interface DashboardUser {
  id?: string;
  email?: string | null;
}

export interface DashboardPhase {
  label: string;
  title: string;
  dates?: string;
  desc?: string;
  items?: string[];
}

export interface DashboardRole {
  key: string;
  label: string;
}

/** All inputs the dashboard render consumes — passed as one snapshot. */
export interface DashboardModel {
  /** Visible events (post visibility filter). */
  events: DashboardEvent[];
  /** All todos (post done filter is the renderer's job). */
  todos: DashboardTodo[];
  /** Currently signed-in profile + user. */
  profile: DashboardProfile | null;
  user: DashboardUser | null;
  /** Active role for the urgent/scoped widgets. */
  roleKey: string;
  /** Today's local-midnight Date. */
  today: Date;
  /** Project release date (R.I.C.H — 2026-09-11). */
  projectDate: Date;
  /** Phase registry (the legacy PHASES array). */
  phases: DashboardPhase[];
  /** Phase index of `phase`. */
  phaseIdx: number;
  /** Resolved current phase (computePhase result). */
  phase: DashboardPhase;
  /** Resolved current role record. */
  role: DashboardRole;
}

/** Result of widget composition — a structured set of HTML fragments + booleans. */
export interface DashboardViewResult {
  greetingName: string;
  greetingAvatarInitial: string;
  greetingAlias: string;
  heroEyebrow: string;
  heroCount: number;
  heroLabel: string;
  heroPhaseHtml: string;
  urgentHidden: boolean;
  urgentHtml: string;
  todayMeta: string;
  todayHtml: string;
  upcomingEmpty: boolean;
  upcomingHtml: string;
  upcomingEmptyHtml: string;
  releaseHidden: boolean;
  releaseHtml: string;
  releaseDataset: { state: string; ariaLabel: string } | null;
  releaseEventId: string | null;
  cardsHtml: string;
}

/**
 * Legacy helpers — injected by main.ts at render time. No `window.X`
 * access in any dashboard module. Mirrors the calendar pattern.
 */
export interface DashboardDeps {
  /** Visibility filter — drops private events from other users. */
  filterVisibleEvents: (events: DashboardEvent[]) => DashboardEvent[];
  /** Per-todo dashboard filter (role-driven). */
  isTodoOnDashboard: (todo: DashboardTodo, roleKey: string) => boolean;
  /** Resolve a todo's canonical priority key. */
  todoPriority: (todo: DashboardTodo) => string;
  /** Format an ISO date short ("12 mai"). */
  formatDate: (s: string | undefined) => string;
  /** Format a time string ("14:30"). */
  formatEventTime: (s: string | undefined) => string;
  /** Type label for an event kind. */
  typeLabel: (t: string | undefined) => string;
  /** HTML escape. */
  escapeHtml: (s: string | null | undefined) => string;
  /** SVG icon HTML. */
  icon: (name: string, size?: number, extra?: string) => string;
  /** Empty-state HTML — used when upcoming list is empty. */
  emptyState: (kind: string, title: string, hint?: string, ctaLabel?: string, ctaOnclick?: string) => string;
  /** Whether a date is today or future (vs `now`). */
  isFutureOrToday: (s: string | undefined, now?: Date) => boolean;
  /** Parse an ISO date. */
  parseDate: (s: string | undefined) => Date | null;
}
