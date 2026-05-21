// ============================================================================
// Dashboard render — DOM mounting. Phase TS-14A.
//
// The ONLY file in /src/render/dashboard/** that talks to the DOM.
// Reads the data layer via `getState()`, builds the model, runs
// composition.buildDashboardView, then applies the result to the
// pre-rendered shell in index.html.
//
// PUBLIC API:
//   - renderDashboardView(deps)              → run a full render pass
//   - registerDashboardSideEffects(hooks)    → inject the side-effects
//                                              the inline code still owns
//                                              (animateCounter, swipe delete,
//                                              renderRoleWidgets, etc.)
//   - registerDashboardModelHook(fn)         → inject the legacy model
//                                              accessors that aren't in
//                                              data/ yet (PHASES, ROLES,
//                                              computePhase, getCurrentRoleKey)
// ============================================================================

import { getState } from '../../data';
import type {
  DashboardDeps,
  DashboardEvent,
  DashboardModel,
  DashboardPhase,
  DashboardProfile,
  DashboardRole,
  DashboardTodo,
  DashboardUser,
  DashboardViewResult,
} from './types';
import { buildDashboardView } from './composition';
import { bindAliasInput } from './widgets/alias-binder';
import { viewTransition } from '../../features/mobile/transitions';

// ---------------------------------------------------------------------------
// Side-effects hooks — registered by main.ts. Keeps mount.ts decoupled
// from animateCounter / attachSwipeDelete / renderRoleWidgets / renderTeamActivity.
// ---------------------------------------------------------------------------

export interface DashboardSideEffects {
  /** Inline role-specific widgets sub-render (data-driven, role-scoped). */
  renderRoleWidgets?: () => void;
  /** Inline async team-activity feed render. */
  renderTeamActivity?: () => Promise<void> | void;
  /** Animate the hero counter from 0 → target. */
  animateCounter?: (el: HTMLElement, target: number) => void;
  /** Attach swipe-to-delete to a row element with a delete handler. */
  attachSwipeDelete?: (el: HTMLElement, onDelete: () => void) => void;
  /** Delete an event by id (called from the swipe handler). */
  swipeDeleteEvent?: (id: string) => void;
  /** Save the alias to the cloud and toast on success/failure. */
  saveAlias?: (alias: string) => Promise<boolean>;
  /** App-wide toast. */
  toast?: (message: string) => void;
  /** openDetail dispatch — for the hero phase click / release card click. */
  openDetail?: (kind: string, id: string | number) => void;
}

let _fx: DashboardSideEffects = {};

export function registerDashboardSideEffects(hooks: DashboardSideEffects): void {
  _fx = { ..._fx, ...hooks };
}

// ---------------------------------------------------------------------------
// Model hook — injects the still-legacy accessors (PHASES / ROLES /
// computePhase / getCurrentRoleKey / PROJECT_DATE) without baking them
// into types.ts. mount.ts calls this once per render to assemble the
// DashboardModel that composition.ts consumes.
// ---------------------------------------------------------------------------

export interface DashboardModelInputs {
  events: DashboardEvent[];
  todos: DashboardTodo[];
  profile: DashboardProfile | null;
  user: DashboardUser | null;
  today: Date;
}

export interface DashboardModelExtras {
  /** Project date (R.I.C.H release). */
  projectDate: Date;
  /** Phase registry (PHASES). */
  phases: DashboardPhase[];
  /** Currently active role key. */
  roleKey: string;
  /** Role record looked up from ROLE_BY_KEY. */
  role: DashboardRole;
  /** Current phase (computePhase result). */
  phase: DashboardPhase;
  /** Index of `phase` in `phases`. */
  phaseIdx: number;
}

type DashboardModelBuilder = (inputs: DashboardModelInputs) => DashboardModelExtras;
let _modelBuilder: DashboardModelBuilder | null = null;

export function registerDashboardModelBuilder(fn: DashboardModelBuilder): void {
  _modelBuilder = fn;
}

// ---------------------------------------------------------------------------
// DOM mounting helpers — read by id, write innerHTML / textContent.
// ---------------------------------------------------------------------------

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setHtml(id: string, html: string): HTMLElement | null {
  const el = document.getElementById(id);
  if (el) viewTransition(() => { el.innerHTML = html; });
  return el;
}

// ---------------------------------------------------------------------------
// Main entry — runs ONE dashboard render pass.
// ---------------------------------------------------------------------------

export function renderDashboardView(deps: DashboardDeps): void {
  if (!_modelBuilder) {
    // No model builder registered — skip silently. main.ts wires this at boot.
    return;
  }

  const state = getState() as {
    events?: DashboardEvent[];
    todos?: DashboardTodo[];
    user?: { name?: string } | null;
  };

  // Read legacy profile/user via the data + auth layers (no window access here).
  // The data layer's getState() returns the workspace; profile + user come
  // through main.ts via the model builder hook (which is allowed to read
  // window — mount.ts is not).
  const inputs: DashboardModelInputs = {
    events: Array.isArray(state.events) ? state.events : [],
    todos: Array.isArray(state.todos) ? state.todos : [],
    profile: null,
    user: null,
    today: new Date(),
  };
  // The model builder fills in the rest (profile, user, projectDate, phases,
  // roleKey, role, phase, phaseIdx) by reading from main.ts's snapshot
  // of the legacy globals + auth state.
  const extras = _modelBuilder(inputs);
  const model: DashboardModel = { ...inputs, ...extras };

  const result: DashboardViewResult = buildDashboardView(model, deps);

  // ---- Apply to DOM ----

  // Greeting
  setText('dashGreetingName', result.greetingName);
  const greetAvatar = document.getElementById('dashGreetingAvatar');
  if (greetAvatar && !greetAvatar.classList.contains('has-image')) {
    greetAvatar.textContent = result.greetingAvatarInitial;
  }
  const aliasEl = document.getElementById('dashGreetingAlias');
  if (aliasEl) {
    if (document.activeElement !== aliasEl) {
      aliasEl.textContent = result.greetingAlias;
    }
    bindAliasInput(aliasEl, result.greetingAlias, {
      saveAlias: (alias) => (_fx.saveAlias ? _fx.saveAlias(alias) : Promise.resolve(false)),
      toast: (msg) => { _fx.toast?.(msg); },
    });
  }

  // Hero
  setText('dashHeroEyebrow', result.heroEyebrow);
  const heroCountEl = document.getElementById('dashHeroCount') as HTMLElement | null;
  if (heroCountEl) {
    heroCountEl.dataset.count = String(result.heroCount);
    heroCountEl.textContent = '0';
    heroCountEl.onclick = () => _fx.openDetail?.('phase', model.phases.length - 1);
  }
  setText('dashHeroLabel', result.heroLabel);
  const phaseBox = document.getElementById('dashHeroPhase');
  if (phaseBox) {
    viewTransition(() => { phaseBox.innerHTML = result.heroPhaseHtml; });
    (phaseBox as HTMLElement).onclick = () => {
      if (model.phaseIdx >= 0) _fx.openDetail?.('phase', model.phaseIdx);
    };
  }

  // Urgent box (hidden vs visible)
  const urgentBox = document.getElementById('urgentBox') as HTMLElement | null;
  if (urgentBox) {
    urgentBox.hidden = result.urgentHidden;
    viewTransition(() => { urgentBox.innerHTML = result.urgentHidden ? '' : result.urgentHtml; });
  }

  // Role widgets + team activity feed (sub-renderers — still inline)
  if (_fx.renderRoleWidgets) {
    try { _fx.renderRoleWidgets(); } catch (e) { console.warn('[renderRoleWidgets]', e); }
  }
  if (_fx.renderTeamActivity) {
    try { Promise.resolve(_fx.renderTeamActivity()).catch((e) => console.warn('[renderTeamActivity]', e)); } catch (_e) { /* no-op */ }
  }

  // Today + upcoming
  setText('dashTodayMeta', result.todayMeta);
  setHtml('todayAgendaWrap', result.todayHtml);
  const upcomingEl = document.getElementById('dashboardUpcoming') as HTMLElement | null;
  if (upcomingEl) {
    if (result.upcomingEmpty) {
      upcomingEl.outerHTML = result.upcomingEmptyHtml;
    } else {
      viewTransition(() => { upcomingEl.innerHTML = result.upcomingHtml; });
    }
  }

  // Release card
  const releaseEl = document.getElementById('dashboardRelease') as HTMLElement | null;
  if (releaseEl) {
    if (result.releaseHidden) {
      releaseEl.hidden = true;
      releaseEl.innerHTML = '';
      releaseEl.onclick = null;
    } else {
      releaseEl.hidden = false;
      if (result.releaseDataset) {
        releaseEl.dataset.state = result.releaseDataset.state;
        releaseEl.setAttribute('role', 'button');
        releaseEl.setAttribute('tabindex', '0');
        releaseEl.setAttribute('aria-label', result.releaseDataset.ariaLabel);
      }
      viewTransition(() => { releaseEl.innerHTML = result.releaseHtml; });
      releaseEl.onclick = () => {
        if (result.releaseEventId) _fx.openDetail?.('event', result.releaseEventId);
      };
      releaseEl.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (result.releaseEventId) _fx.openDetail?.('event', result.releaseEventId);
        }
      };
    }
  }

  // Stats
  setHtml('dashboardCards', result.cardsHtml);

  // Animate hero counter (post-DOM-update)
  setTimeout(() => {
    if (heroCountEl && _fx.animateCounter) {
      const target = parseInt(heroCountEl.dataset.count || '0', 10);
      _fx.animateCounter(heroCountEl, target);
    }
  }, 120);

  // Swipe-to-delete on upcoming + today
  if (_fx.attachSwipeDelete && _fx.swipeDeleteEvent) {
    document.querySelectorAll<HTMLElement>('#dashboardUpcoming [data-event-id]').forEach((el) => {
      const id = el.dataset.eventId;
      if (id) _fx.attachSwipeDelete!(el, () => _fx.swipeDeleteEvent!(id));
    });
    document.querySelectorAll<HTMLElement>('#todayAgendaWrap .agenda-item').forEach((el) => {
      const onclickStr = el.getAttribute('onclick') || '';
      const m = onclickStr.match(/openDetail\('event','([^']+)'\)/);
      if (m && m[1]) _fx.attachSwipeDelete!(el, () => _fx.swipeDeleteEvent!(m[1]));
    });
  }
}
