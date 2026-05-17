// ============================================================================
// App.Runtime — Phase 0.1 of the incremental modularization plan v3.
// Extracted to TypeScript in Phase TS-1.
//
// Generic lifecycle registry. Tracks timers, intervals, animation frames,
// event listeners, MutationObservers, IntersectionObservers, and arbitrary
// unsubscribe functions. Provides idempotent dispose() so future modules can
// extract cleanly without leaking handles.
//
// DESIGN RULES (non-negotiable):
// - Generic only. ZERO domain knowledge (no Supabase, no audio, no state).
// - All side-effect APIs return a disposer or are auto-tracked.
// - createScope(name) returns a child registry with isolated dispose().
// - dispose() is idempotent.
// - Errors in disposers are caught and logged, never thrown.
// - No async (Runtime itself is fully sync; consumers manage their own).
// - No classes, no `this` binding.
//
// DOM HELPERS (Phase 0.4 addition):
// - qs(selector, root?), qsa(selector, root?), byId(id), matches(el, selector)
// - Ultra-thin wrappers around native DOM APIs. No cache, no auto-rebind,
//   no event delegation. Pure functions, scope-independent.
// ============================================================================

type Disposer = () => void;

interface ScopeState {
  disposers: Set<Disposer>;
  timers: Set<number>;
  intervals: Set<number>;
  rafs: Set<number>;
  observers: Set<MutationObserver | IntersectionObserver>;
}

export interface RuntimeScope {
  name: string;
  setTimeout: (fn: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
  setInterval: (fn: () => void, ms: number) => number;
  clearInterval: (id: number) => void;
  requestAnimationFrame: (fn: (t: number) => void) => number;
  cancelAnimationFrame: (id: number) => void;
  addEventListener: (target: EventTarget, event: string, fn: EventListener, options?: AddEventListenerOptions | boolean) => Disposer;
  observe: (target: Node, callback: MutationCallback, options?: MutationObserverInit) => MutationObserver;
  intersectionObserve: (target: Element, callback: IntersectionObserverCallback, options?: IntersectionObserverInit) => IntersectionObserver;
  subscribe: (unsubFn: Disposer) => Disposer;
  onDispose: (fn: Disposer) => Disposer;
  dispose: () => void;
  readonly disposed: boolean;
  _state: ScopeState;
}

export interface RuntimeAPI {
  setTimeout: RuntimeScope['setTimeout'];
  clearTimeout: RuntimeScope['clearTimeout'];
  setInterval: RuntimeScope['setInterval'];
  clearInterval: RuntimeScope['clearInterval'];
  requestAnimationFrame: RuntimeScope['requestAnimationFrame'];
  cancelAnimationFrame: RuntimeScope['cancelAnimationFrame'];
  addEventListener: RuntimeScope['addEventListener'];
  observe: RuntimeScope['observe'];
  intersectionObserve: RuntimeScope['intersectionObserve'];
  subscribe: RuntimeScope['subscribe'];
  onDispose: RuntimeScope['onDispose'];
  dispose: RuntimeScope['dispose'];
  createScope: (name: string) => RuntimeScope;
  qs: (selector: string, root?: ParentNode) => Element | null;
  qsa: (selector: string, root?: ParentNode) => Element[];
  byId: (id: string) => HTMLElement | null;
  matches: (el: unknown, selector: string) => boolean;
  _global: RuntimeScope;
}

function createScope(name: string): RuntimeScope {
  var disposers: Set<Disposer> = new Set();
  var timers: Set<number> = new Set();
  var intervals: Set<number> = new Set();
  var rafs: Set<number> = new Set();
  var observers: Set<MutationObserver | IntersectionObserver> = new Set();
  var _disposed = false;

  function _setTimeout(fn: () => void, ms: number): number {
    var id = window.setTimeout(function () {
      timers.delete(id);
      if (_disposed) return;
      try { fn(); } catch (e) { console.error('[Runtime/' + name + '] setTimeout cb:', e); }
    }, ms);
    timers.add(id);
    return id;
  }
  function _clearTimeout(id: number): void { window.clearTimeout(id); timers.delete(id); }

  function _setInterval(fn: () => void, ms: number): number {
    var id = window.setInterval(function () {
      if (_disposed) return;
      try { fn(); } catch (e) { console.error('[Runtime/' + name + '] setInterval cb:', e); }
    }, ms);
    intervals.add(id);
    return id;
  }
  function _clearInterval(id: number): void { window.clearInterval(id); intervals.delete(id); }

  function _requestAnimationFrame(fn: (t: number) => void): number {
    var id = window.requestAnimationFrame(function (t) {
      rafs.delete(id);
      if (_disposed) return;
      try { fn(t); } catch (e) { console.error('[Runtime/' + name + '] rAF cb:', e); }
    });
    rafs.add(id);
    return id;
  }
  function _cancelAnimationFrame(id: number): void { window.cancelAnimationFrame(id); rafs.delete(id); }

  function _addEventListener(target: EventTarget, event: string, fn: EventListener, options?: AddEventListenerOptions | boolean): Disposer {
    target.addEventListener(event, fn, options);
    var disposer: Disposer = function () {
      try { target.removeEventListener(event, fn, options); } catch (e) {}
    };
    disposers.add(disposer);
    return disposer;
  }

  function _observe(target: Node, callback: MutationCallback, options?: MutationObserverInit): MutationObserver {
    var obs = new MutationObserver(callback);
    obs.observe(target, options);
    observers.add(obs);
    var disposer: Disposer = function () {
      try { obs.disconnect(); } catch (e) {}
      observers.delete(obs);
    };
    disposers.add(disposer);
    return obs;
  }

  function _intersectionObserve(target: Element, callback: IntersectionObserverCallback, options?: IntersectionObserverInit): IntersectionObserver {
    var obs = new IntersectionObserver(callback, options);
    obs.observe(target);
    observers.add(obs);
    var disposer: Disposer = function () {
      try { obs.disconnect(); } catch (e) {}
      observers.delete(obs);
    };
    disposers.add(disposer);
    return obs;
  }

  function _subscribe(unsubFn: Disposer): Disposer {
    if (typeof unsubFn === 'function') disposers.add(unsubFn);
    return unsubFn;
  }
  function _onDispose(fn: Disposer): Disposer {
    if (typeof fn === 'function') disposers.add(fn);
    return fn;
  }

  function _dispose(): void {
    if (_disposed) return;
    _disposed = true;
    timers.forEach(function (id) { window.clearTimeout(id); });
    intervals.forEach(function (id) { window.clearInterval(id); });
    rafs.forEach(function (id) { window.cancelAnimationFrame(id); });
    observers.forEach(function (o) { try { o.disconnect(); } catch (e) {} });
    disposers.forEach(function (d) {
      try { d(); } catch (e) { console.warn('[Runtime/' + name + '] disposer:', e); }
    });
    timers.clear(); intervals.clear(); rafs.clear();
    observers.clear(); disposers.clear();
  }

  return Object.freeze({
    name: name,
    setTimeout: _setTimeout,
    clearTimeout: _clearTimeout,
    setInterval: _setInterval,
    clearInterval: _clearInterval,
    requestAnimationFrame: _requestAnimationFrame,
    cancelAnimationFrame: _cancelAnimationFrame,
    addEventListener: _addEventListener,
    observe: _observe,
    intersectionObserve: _intersectionObserve,
    subscribe: _subscribe,
    onDispose: _onDispose,
    dispose: _dispose,
    get disposed() { return _disposed; },
    _state: { disposers: disposers, timers: timers, intervals: intervals, rafs: rafs, observers: observers },
  }) as RuntimeScope;
}

// The "global" scope is the default registry used by Runtime's top-level API.
// Module-level code that needs isolated cleanup should call createScope('name').
var globalScope = createScope('global');

// DOM helpers — Phase 0.4 addition. Pure functions, no internal state.
function qs(selector: string, root?: ParentNode): Element | null {
  return (root || document).querySelector(selector);
}
function qsa(selector: string, root?: ParentNode): Element[] {
  return Array.from((root || document).querySelectorAll(selector));
}
function byId(id: string): HTMLElement | null {
  return document.getElementById(id);
}
function matches(el: unknown, selector: string): boolean {
  return !!el && typeof (el as Element).matches === 'function' && (el as Element).matches(selector);
}

export const Runtime: RuntimeAPI = Object.freeze({
  setTimeout: globalScope.setTimeout,
  clearTimeout: globalScope.clearTimeout,
  setInterval: globalScope.setInterval,
  clearInterval: globalScope.clearInterval,
  requestAnimationFrame: globalScope.requestAnimationFrame,
  cancelAnimationFrame: globalScope.cancelAnimationFrame,
  addEventListener: globalScope.addEventListener,
  observe: globalScope.observe,
  intersectionObserve: globalScope.intersectionObserve,
  subscribe: globalScope.subscribe,
  onDispose: globalScope.onDispose,
  dispose: globalScope.dispose,
  createScope: createScope,
  qs: qs,
  qsa: qsa,
  byId: byId,
  matches: matches,
  _global: globalScope,
});
