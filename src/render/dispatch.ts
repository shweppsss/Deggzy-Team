// ============================================================================
// Render dispatch — central registry + invalidation queue. Phase TS-12.
//
// Replaces the inline `renderView` / `renderAll` / `requestRender` /
// `RENDER_SECTIONS` / `STATE_DEPS` / `diffStateScopes`. The actual
// DOM-rendering bodies (`renderDashboard`, `renderTodos`, etc.) still
// live inline — they're too big for TS-12. main.ts registers them as
// the implementations of each section's slot.
//
// PUBLIC API:
//   - registerSectionRenderer(id, fn)  → wire one section
//   - renderRoute(view)                → "navigate to a route" entry point
//   - renderAll(opts?)                 → render every (or a subset) of sections
//   - invalidateSection(id)            → queue a section for next-frame render
//   - scheduleRender()                 → flush queued sections in one rAF tick
//   - getDirtySectionsForStateKeys(...) → STATE_DEPS lookup
//
// DESIGN RULES (per directive):
// - No optimization / batching layer beyond rAF coalescing.
// - No event bus, no signals — just a Map<SectionId, RenderFn>.
// - Failure in one section never aborts the loop (matches inline).
// - SC46 verifies that 100 invalidateSection() calls collapse to ONE
//   render pass under rAF batching.
// ============================================================================

import type { RouteName, SectionId, RenderFn, RenderOpts } from './types';

// ---------------------------------------------------------------------------
// Section registry — main.ts registers each implementation.
// ---------------------------------------------------------------------------

const _renderers = new Map<SectionId, RenderFn>();

export function registerSectionRenderer(id: SectionId, fn: RenderFn): void {
  _renderers.set(id, fn);
}

/** Read-only snapshot for diagnostics + tests. */
export function getRegisteredSections(): SectionId[] {
  return Array.from(_renderers.keys());
}

/** Test-only: clear the registry. */
export function _resetSectionRegistry(): void {
  _renderers.clear();
}

// ---------------------------------------------------------------------------
// Route → section mapping. The legacy `renderView(view)` named the route
// strings differently from the section ids (`'calendrier'` → `'calendar'`,
// `'equipe'` → `'team'`). The map below stays inside this module so
// callers don't have to know about the asymmetry.
// ---------------------------------------------------------------------------

const ROUTE_TO_SECTION: Record<string, SectionId> = {
  dashboard:    'dashboard',
  profile:      'profile',
  todos:        'todos',
  catalogue:    'catalogue',
  calendrier:   'calendar',
  inspirations: 'inspirations',
  clips:        'clips',
  capsules:     'capsules',
  assets:       'assets',
  equipe:       'team',
  budget:       'budget',
  plan:         'plan',
  kpi:          'kpi',
};

/**
 * Navigate to a route — runs the registered renderer for the route's
 * mapped section (and `profile` runs the alias-edit setup hook too,
 * preserved from inline behavior via an optional post-render callback).
 */
export function renderRoute(view: RouteName | string): void {
  const section = ROUTE_TO_SECTION[view];
  if (!section) return;
  const fn = _renderers.get(section);
  if (!fn) return;
  try {
    fn();
  } catch (e) {
    console.error('[Render] route "' + view + '" → ' + section + ' failed:', e);
  }
  // Special case carried over from inline: profile route also runs
  // setupProfileAliasEdit. We expose a registration point for this
  // so dispatch.ts doesn't import a feature-specific helper.
  if (section === 'profile' && _postRouteHooks[section]) {
    try { _postRouteHooks[section]?.(); } catch (_e) { /* no-op */ }
  }
}

const _postRouteHooks: Partial<Record<SectionId, () => void>> = {};

/** Register a post-route hook (e.g. `setupProfileAliasEdit` for `profile`). */
export function registerPostRouteHook(section: SectionId, fn: () => void): void {
  _postRouteHooks[section] = fn;
}

// ---------------------------------------------------------------------------
// renderAll — run every registered renderer, isolated.
// ---------------------------------------------------------------------------

export function renderAll(opts?: RenderOpts): void {
  const only = opts?.only ? new Set<SectionId>(opts.only) : null;
  for (const [id, fn] of _renderers.entries()) {
    if (only && !only.has(id)) continue;
    try {
      fn();
    } catch (e) {
      console.error('[Render] ' + id + ' failed:', e);
      // Sentry hook lives in main.ts (still uses inline `captureSentryException`).
      if (_renderFailureHook) {
        try { _renderFailureHook(id, e); } catch (_e2) { /* no-op */ }
      }
    }
  }
}

type RenderFailureHook = (section: SectionId, error: unknown) => void;
let _renderFailureHook: RenderFailureHook | null = null;

export function registerRenderFailureHook(fn: RenderFailureHook | null): void {
  _renderFailureHook = fn;
}

// ---------------------------------------------------------------------------
// rAF-coalesced invalidation queue. Multiple invalidate() in one tick
// collapse to ONE renderAll pass (SC46).
// ---------------------------------------------------------------------------

let _queueScopes: SectionId[] | null = null;
let _queueFrame: number | null = null;
let _queueFull = false;
// Test hook so SC46 can observe how many render passes actually fired
// without needing to instrument the renderers themselves.
let _renderPassCounter = 0;

export function _getRenderPassCount(): number {
  return _renderPassCounter;
}

export function _resetRenderPassCount(): void {
  _renderPassCounter = 0;
}

/**
 * Queue a section for re-render on the next animation frame. Repeated
 * calls in the same tick collapse: 100 invalidate() → 1 renderAll pass.
 * If anything later asks for a full render, the queue is promoted.
 */
export function invalidateSection(section: SectionId): void {
  if (_queueFull) {
    // Already a full pass queued — nothing to add.
  } else {
    if (_queueScopes === null) _queueScopes = [];
    if (!_queueScopes.includes(section)) _queueScopes.push(section);
  }
  _scheduleFrame();
}

/**
 * Queue a full re-render on the next frame. Same coalescing as
 * invalidateSection but unconditional.
 */
export function scheduleRender(opts?: RenderOpts): void {
  if (opts?.only) {
    if (!_queueFull) {
      if (_queueScopes === null) _queueScopes = [];
      for (const s of opts.only) {
        if (!_queueScopes.includes(s)) _queueScopes.push(s);
      }
    }
  } else {
    _queueFull = true;
    _queueScopes = null;
  }
  _scheduleFrame();
}

/** Internal: schedule the rAF flush. */
function _scheduleFrame(): void {
  if (_queueFrame !== null) return;
  // Some environments don't expose requestAnimationFrame (Node harness).
  // Fall back to a microtask so the queue still flushes deterministically.
  if (typeof requestAnimationFrame === 'function') {
    _queueFrame = requestAnimationFrame(_flush);
  } else {
    _queueFrame = -1;
    queueMicrotask(_flush);
  }
}

/** Internal: drain the queue. Test code can call this explicitly. */
export function _flushRenderQueue(): void {
  _flush();
}

function _flush(): void {
  const wasFull = _queueFull;
  const scopes = _queueScopes;
  _queueFull = false;
  _queueScopes = null;
  _queueFrame = null;
  _renderPassCounter += 1;
  renderAll(wasFull || !scopes ? undefined : { only: scopes });
}

// ---------------------------------------------------------------------------
// STATE_DEPS — which sections depend on which state keys. Used by the
// realtime patcher (still inline) to compute the minimal re-render set
// after an inbound payload.
// ---------------------------------------------------------------------------

export const STATE_DEPS: Readonly<Record<string, ReadonlyArray<SectionId>>> = Object.freeze({
  events:       ['dashboard', 'calendar'],
  todos:        ['dashboard', 'todos'],
  tracks:       ['dashboard', 'catalogue'],
  inspirations: ['inspirations'],
  clips:        ['clips'],
  capsules:     ['capsules'],
  assets:       ['assets'],
  team:         ['team', 'dashboard'],
  budget:       ['budget'],
  plan:         ['plan'],
  kpi:          ['kpi'],
  user:         ['profile'],
  streak:       ['dashboard'],
  tagFilter:    ['calendar', 'todos', 'dashboard'],
});

/**
 * Given a list of state keys that changed (e.g. realtime payload),
 * return the unique set of sections that need a re-render.
 */
export function getDirtySectionsForStateKeys(keys: ReadonlyArray<string>): SectionId[] {
  const out = new Set<SectionId>();
  for (const k of keys) {
    const sections = STATE_DEPS[k];
    if (!sections) continue;
    for (const s of sections) out.add(s);
  }
  return Array.from(out);
}
