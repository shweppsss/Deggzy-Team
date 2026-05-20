// ============================================================================
// Detail overlay — open/close lifecycle. Phase TS-6 (extracted), TS-7 (rendered).
//
// This is the FIRST business-domain TS module. Scope is intentionally
// narrow: open / close / wire-close-buttons.
//
// THE T1 ROLLBACK CONTRACT (verified by SC11 in the harness):
// `openDetail` sets `body.style.overflow = 'hidden'` BEFORE invoking any
// hydrate path that may throw. If anything after the scroll lock throws,
// we MUST restore `body.style.overflow = ''` AND remove `.open` AND
// rethrow the original error — otherwise the overlay leaks a body-scroll
// lock. The harness pins this in SC11; any change here that breaks
// rollback ordering trips SC11.
//
// TS-7 update: HTML composition is now done by the per-kind typed
// renderers in `./render/`. lifecycle.ts:
//   1. looks up the entity by id (only legitimate global access — state)
//   2. looks up related entities (kind-specific heuristics)
//   3. builds a RenderDeps snapshot from window legacy helpers
//   4. calls the appropriate renderXxx(entity, deps, ctx) → string
//   5. writes the HTML to detailBody
// The renderers themselves are 100% pure: no window, no document, no state.
//
// DEPENDENCIES (still legacy inline — typed window accessors with guards):
//   - state.{events, tracks, todos, inspirations, team}    app state
//   - PHASES                                                phase registry
//   - typeLabel(t)                                          kind label helper
//   - renderView(name)                                      view re-render (closeDetail)
// ============================================================================

import type { DetailKind } from './types';
import { hydrateDetailAudio, hydrateDetailCover } from './hydrate';
import {
  getRenderDeps,
  renderEvent,
  renderTrack,
  renderTodo,
  renderInspi,
  renderMember,
  renderPhase,
  type EventEntity,
  type TrackEntity,
  type TodoEntity,
  type InspiEntity,
  type MemberEntity,
  type PhaseEntity,
} from './render';

interface EntityWithId {
  id: string;
  [key: string]: unknown;
}

interface StateLike {
  events?: EntityWithId[];
  tracks?: EntityWithId[];
  todos?: EntityWithId[];
  inspirations?: EntityWithId[];
  team?: EntityWithId[];
}

interface AppRuntimeLike {
  qsa: (sel: string) => Element[];
}

type Win = Window & {
  state?: StateLike;
  PHASES?: Record<string, unknown>;
  typeLabel?: (t: string | undefined) => string;
  renderView?: (name: string) => void;
  App?: { Runtime?: AppRuntimeLike };
};

function w(): Win {
  return window as unknown as Win;
}

function findById(list: EntityWithId[] | undefined, id: string): EntityWithId | undefined {
  if (!Array.isArray(list)) return undefined;
  return list.find((x) => x.id === id);
}

// Find a track whose name appears inside the event title (legacy heuristic).
function findRelatedTrack(state: StateLike, eventTitle: string | undefined): { id: string; name?: string } | null {
  if (!eventTitle || !Array.isArray(state.tracks)) return null;
  const lower = eventTitle.toLowerCase();
  const hit = state.tracks.find((t) => {
    const name = typeof t.name === 'string' ? t.name : '';
    return name.length > 3 && lower.includes(name.toLowerCase());
  });
  if (!hit) return null;
  return { id: hit.id, name: typeof hit.name === 'string' ? hit.name : undefined };
}

// Find events whose title contains the track name (legacy heuristic).
function findRelatedEvents(state: StateLike, trackName: string | undefined): Array<{ id: string; type?: string; title?: string; date?: string; time?: string }> {
  if (!trackName || trackName.length <= 3 || !Array.isArray(state.events)) return [];
  const lower = trackName.toLowerCase();
  return state.events
    .filter((e) => {
      const title = typeof e.title === 'string' ? e.title : '';
      return title.toLowerCase().includes(lower);
    })
    .map((e) => ({
      id: e.id,
      type: typeof e.type === 'string' ? e.type : undefined,
      title: typeof e.title === 'string' ? e.title : undefined,
      date: typeof e.date === 'string' ? e.date : undefined,
      time: typeof e.time === 'string' ? e.time : undefined,
    }));
}

// Filter todos belonging to a strategic phase (legacy heuristic by index).
function findPhaseTodos(state: StateLike, phaseIdx: string): Array<{ id: string; text?: string; done?: boolean; urgent?: boolean }> {
  if (!Array.isArray(state.todos)) return [];
  const catByIdx: Record<string, string> = {
    '0': 'Pre-Launch',
    '1': 'Rollout',
    '2': 'Pivot',
    '3': 'Élévation',
    '4': 'Événement',
  };
  const cat = catByIdx[phaseIdx];
  if (!cat) return [];
  return state.todos
    .filter((t) => t.cat === cat)
    .map((t) => ({
      id: t.id,
      text: typeof t.text === 'string' ? t.text : undefined,
      done: t.done === true,
      urgent: t.urgent === true,
    }));
}

// Resolve the (kindLabel, html) pair for a given (kind, id) by:
//   - looking up the entity in the legacy state
//   - looking up related entities (still in legacy state)
//   - calling the appropriate pure renderer with a RenderDeps snapshot
function resolveKind(kind: DetailKind, id: string): { kindLabel: string; html: string } | null {
  const state = w().state || {};
  const deps = getRenderDeps();

  switch (kind) {
    case 'event': {
      const e = findById(state.events, id) as EventEntity | undefined;
      if (!e) return null;
      const labelFn = w().typeLabel;
      const kindLabel = typeof labelFn === 'function' ? labelFn(e.type) : '';
      const relatedTrack = findRelatedTrack(state, e.title);
      return { kindLabel, html: renderEvent(e, deps, { relatedTrack }) };
    }
    case 'track': {
      const t = findById(state.tracks, id) as TrackEntity | undefined;
      if (!t) return null;
      const relatedEvents = findRelatedEvents(state, t.name);
      return { kindLabel: 'Morceau', html: renderTrack(t, deps, { relatedEvents }) };
    }
    case 'todo': {
      const t = findById(state.todos, id) as TodoEntity | undefined;
      if (!t) return null;
      const cat = typeof t.cat === 'string' ? t.cat : '';
      return { kindLabel: 'Tâche · ' + cat, html: renderTodo(t, deps) };
    }
    case 'inspi': {
      // Inspirations may be looked up by id OR by numeric index (legacy
      // pattern — kept verbatim from inline implementation).
      const list = state.inspirations;
      let i: EntityWithId | undefined;
      if (Array.isArray(list)) {
        i = list.find((x) => x.id === id) || list[Number(id)];
      }
      if (!i) return null;
      const insp = i as InspiEntity;
      const cat = typeof insp.category === 'string' ? insp.category : 'Autre';
      return { kindLabel: 'Inspiration · ' + cat, html: renderInspi(insp, deps) };
    }
    case 'member': {
      const m = findById(state.team, id) as MemberEntity | undefined;
      if (!m) return null;
      return { kindLabel: 'Équipe', html: renderMember(m, deps) };
    }
    case 'phase': {
      const phases = w().PHASES;
      if (!phases) return null;
      const p = phases[id] as PhaseEntity | undefined;
      if (!p) return null;
      const relatedTodos = findPhaseTodos(state, id);
      return { kindLabel: 'Phase stratégique', html: renderPhase(p, deps, { relatedTodos }) };
    }
    default: {
      // Exhaustive check — TypeScript ensures all DetailKind values are
      // handled. If a new kind is added to the union, this default branch
      // becomes a compile-time error.
      const _exhaustive: never = kind;
      void _exhaustive;
      return null;
    }
  }
}

// Bind the close buttons in the detail overlay (1 static back button in
// the header + up to 5 dynamic "Fermer" buttons rendered by the per-kind
// renderers). Idempotent via `data-detail-close-bound`. Called from
// inside openDetail() after the innerHTML write — the natural mount
// point for the dynamic buttons; the static back button gets caught on
// first call and is then skipped.
export function bindDetailClose(): void {
  const R = w().App?.Runtime;
  const buttons: Element[] = R
    ? R.qsa('[data-detail-close]')
    : Array.from(document.querySelectorAll('[data-detail-close]'));
  buttons.forEach((btn) => {
    const el = btn as HTMLElement;
    if (el.dataset.detailCloseBound === '1') return;
    el.addEventListener('click', () => {
      closeDetail();
    });
    el.dataset.detailCloseBound = '1';
  });
}

export function openDetail(kind: DetailKind, id: string): void {
  const resolved = resolveKind(kind, id);
  if (!resolved) return;

  const kindEl = document.getElementById('detailKind');
  const bodyEl = document.getElementById('detailBody');
  const overlayEl = document.getElementById('detailOverlay');
  if (!kindEl || !bodyEl || !overlayEl) return;

  kindEl.textContent = resolved.kindLabel;
  bodyEl.innerHTML = resolved.html;
  overlayEl.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Wire the close buttons (back button + the kind-specific "Fermer"
  // button rendered into detailBody). Idempotent; safe to call on every open.
  bindDetailClose();

  // T1 ROLLBACK CONTRACT — see file-header comment. SC11 in the
  // verification harness pins this contract; break the order and SC11 fails.
  try {
    window.scrollTo(0, 0);
    // Hydrate IDB audio + cover if it's a track detail.
    if (kind === 'track') {
      // These return Promises — we deliberately do NOT await them so
      // openDetail stays synchronous (matches inline behavior). The
      // try/catch only catches synchronous throws inside the call site;
      // async rejections are unhandled by design (same as inline).
      hydrateDetailAudio(id);
      hydrateDetailCover(id);
    }
  } catch (e) {
    document.body.style.overflow = '';
    overlayEl.classList.remove('open');
    throw e;
  }
}

export function closeDetail(): void {
  const overlayEl = document.getElementById('detailOverlay');
  if (overlayEl) overlayEl.classList.remove('open');
  document.body.style.overflow = '';
  // Re-render current view (in case data was modified).
  const activeNav = document.querySelector<HTMLElement>('.nav-item.active');
  const renderView = w().renderView;
  if (activeNav && typeof renderView === 'function') {
    renderView(activeNav.dataset.view || '');
  }
}
