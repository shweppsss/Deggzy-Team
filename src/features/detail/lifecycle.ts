// ============================================================================
// Detail overlay — open/close lifecycle. Phase TS-6.
//
// This is the FIRST business-domain TS module. Scope is intentionally
// narrow: open / close / wire-close-buttons.
//
// THE T1 ROLLBACK CONTRACT (verified by SC11 in the harness):
// `openDetail` sets `body.style.overflow = 'hidden'` BEFORE invoking any
// hydrate path that may throw. If anything after the scroll lock throws,
// we MUST restore `body.style.overflow = ''` AND remove `.open` AND
// rethrow the original error — otherwise the overlay leaks a body-scroll
// lock. The harness pins this in SC11 with a stubbed `hydrateDetailAudio`
// that throws; any change here that breaks rollback ordering trips SC11.
//
// DEPENDENCIES (still legacy inline — typed window accessors with guards):
//   - state.{events, tracks, todos, inspirations, team}    app state
//   - PHASES                                                phase registry
//   - typeLabel(t)                                          kind label helper
//   - detailEventHTML / detailTrackHTML / detailTodoHTML
//     / detailInspiHTML / detailMemberHTML / detailPhaseHTML  HTML composers
//   - renderView(name)                                      view re-render
//   - bindDetailClose() — defined HERE, exported, also reattached to window
//     so the inline buttons-bound-by-render flow keeps working.
//
// `hydrateDetailAudio` / `hydrateDetailCover` are imported from `./hydrate`
// — first real intra-feature TS edge.
// ============================================================================

import type { DetailKind } from './types';
import { hydrateDetailAudio, hydrateDetailCover } from './hydrate';

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
  typeLabel?: (t: unknown) => string;
  detailEventHTML?: (e: EntityWithId) => string;
  detailTrackHTML?: (t: EntityWithId) => string;
  detailTodoHTML?: (t: EntityWithId) => string;
  detailInspiHTML?: (i: EntityWithId) => string;
  detailMemberHTML?: (m: EntityWithId) => string;
  detailPhaseHTML?: (p: unknown, id: string) => string;
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

// Resolve the (entity, html, kindLabel) triple for a given (kind, id).
// Returns null if either the entity is missing or its renderer is not yet
// available on the window (early boot — should not happen in practice).
function resolveKind(kind: DetailKind, id: string): { kindLabel: string; html: string } | null {
  const win = w();
  const state = win.state || {};

  switch (kind) {
    case 'event': {
      const e = findById(state.events, id);
      if (!e) return null;
      const labelFn = win.typeLabel;
      const renderFn = win.detailEventHTML;
      if (typeof renderFn !== 'function') return null;
      return {
        kindLabel: typeof labelFn === 'function' ? labelFn(e.type) : '',
        html: renderFn(e),
      };
    }
    case 'track': {
      const t = findById(state.tracks, id);
      if (!t) return null;
      const renderFn = win.detailTrackHTML;
      if (typeof renderFn !== 'function') return null;
      return { kindLabel: 'Morceau', html: renderFn(t) };
    }
    case 'todo': {
      const t = findById(state.todos, id);
      if (!t) return null;
      const renderFn = win.detailTodoHTML;
      if (typeof renderFn !== 'function') return null;
      const cat = typeof t.cat === 'string' ? t.cat : '';
      return { kindLabel: 'Tâche · ' + cat, html: renderFn(t) };
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
      const renderFn = win.detailInspiHTML;
      if (typeof renderFn !== 'function') return null;
      const cat = typeof i.category === 'string' ? i.category : 'Autre';
      return { kindLabel: 'Inspiration · ' + cat, html: renderFn(i) };
    }
    case 'member': {
      const m = findById(state.team, id);
      if (!m) return null;
      const renderFn = win.detailMemberHTML;
      if (typeof renderFn !== 'function') return null;
      return { kindLabel: 'Équipe', html: renderFn(m) };
    }
    case 'phase': {
      const phases = win.PHASES;
      if (!phases) return null;
      const p = phases[id];
      if (!p) return null;
      const renderFn = win.detailPhaseHTML;
      if (typeof renderFn !== 'function') return null;
      return { kindLabel: 'Phase stratégique', html: renderFn(p, id) };
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
// the header + up to 5 dynamic "Fermer" buttons rendered into detailBody
// by the inline detailXxxHTML helpers). Idempotent via
// `data-detail-close-bound`. Called from inside openDetail() after the
// innerHTML write — the natural mount point for the dynamic buttons;
// the static back button gets caught on first call and is then skipped.
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

  // Anything after the scroll lock that may throw must be rolled back so
  // the lock doesn't outlive a partially-opened overlay. SC11 in the
  // verification harness pins this contract — break the order and SC11 fails.
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
