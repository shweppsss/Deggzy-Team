// ============================================================================
// App.Boot — Phase 0.2 of the incremental modularization plan v3.
// Extracted to TypeScript in Phase TS-2.
//
// Coordination infrastructure for boot phases. Provides:
//   - register(name, opts) — declare a named boot phase
//   - run() — execute all PENDING phases in registration order, awaiting
//     each before the next (sequential, deterministic)
//   - status(name?) — query a single phase status or a snapshot of all
//   - STATUS — frozen enum (pending / running / done / failed / skipped)
//
// DESIGN RULES (non-negotiable, same as Phase 0.1):
// - Pure infrastructure. No consumer is wired here. No legacy setTimeout
//   is wrapped. No existing boot phase is auto-registered.
// - Boot depends on Runtime (uses App.Runtime.setTimeout for delay
//   scheduling — so delayed phases are tracked + cancellable). Runtime
//   never depends on Boot. No inverse coupling.
// - Phase fn() may be sync OR return a thenable — both are awaited.
// - Errors in a phase fn() are caught + logged, never thrown to the caller.
//   The phase is marked FAILED but run() continues to the next phase.
// - Missing dep or non-DONE dep at moment of execution → phase SKIPPED.
//   No topological sort — phases run in registration order.
// - Object.freeze on the public API. Phases stored in a private Map.
// - No async/await syntax (matches the style of App.Runtime); explicit
//   Promise chaining throughout.
//
// DEPENDENCY ON RUNTIME: Boot uses `window.App.Runtime.setTimeout`
// LAZILY — only inside `_runPhase()`, which only fires from `run()`.
// `run()` is called by consumers AFTER the deferred module loads, so
// `window.App.Runtime` is always defined at the moment of use. We do
// NOT import Runtime here because Boot must remain compatible with the
// historical inline-script call pattern (`App.Runtime.setTimeout`).
// ============================================================================

type PhaseStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

interface BootPhase {
  name: string;
  fn: () => unknown | Promise<unknown>;
  deps: string[];
  delay: number;
  status: PhaseStatus;
  error: Error | null;
}

interface BootPhaseOptions {
  fn: () => unknown | Promise<unknown>;
  deps?: string[];
  delay?: number;
}

export interface BootAPI {
  register: (name: string, opts: BootPhaseOptions) => void;
  run: () => Promise<void>;
  status: (name?: string) => PhaseStatus | Record<string, PhaseStatus> | null;
  STATUS: {
    readonly PENDING: 'pending';
    readonly RUNNING: 'running';
    readonly DONE: 'done';
    readonly FAILED: 'failed';
    readonly SKIPPED: 'skipped';
  };
  _phases: Map<string, BootPhase>;
  _reset: () => void;
}

// Minimal duck-type for the parts of App.Runtime that Boot reads. Kept
// here (instead of imported) so this module doesn't create a hard
// build-time coupling: Boot only needs setTimeout, and it accesses it
// through the global window.App.Runtime at call-time.
interface RuntimeLike {
  setTimeout: (fn: () => void, ms: number) => number;
}

function getRuntime(): RuntimeLike | null {
  if (typeof window === 'undefined') return null;
  const app = (window as unknown as { App?: { Runtime?: RuntimeLike } }).App;
  return (app && app.Runtime) || null;
}

const STATUS = Object.freeze({
  PENDING: 'pending' as const,
  RUNNING: 'running' as const,
  DONE: 'done' as const,
  FAILED: 'failed' as const,
  SKIPPED: 'skipped' as const,
});

const phases: Map<string, BootPhase> = new Map();

function register(name: string, opts: BootPhaseOptions): void {
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error('[Boot] register: name must be a non-empty string');
  }
  if (phases.has(name)) {
    throw new Error('[Boot] register: phase "' + name + '" already registered');
  }
  opts = opts || ({} as BootPhaseOptions);
  if (typeof opts.fn !== 'function') {
    throw new Error('[Boot] register: opts.fn must be a function');
  }
  const deps: string[] = Array.isArray(opts.deps) ? opts.deps.slice() : [];
  const delay: number = (typeof opts.delay === 'number' && opts.delay > 0) ? opts.delay : 0;
  phases.set(name, {
    name: name,
    fn: opts.fn,
    deps: deps,
    delay: delay,
    status: STATUS.PENDING,
    error: null,
  });
}

function status(name?: string): PhaseStatus | Record<string, PhaseStatus> | null {
  if (typeof name === 'undefined') {
    const snap: Record<string, PhaseStatus> = {};
    phases.forEach(function (p, n) { snap[n] = p.status; });
    return snap;
  }
  const p = phases.get(name);
  return p ? p.status : null;
}

function _runPhase(phase: BootPhase): Promise<void> {
  // Status gate — if a concurrent run() (or a re-entry from a phase fn
  // itself) has already picked this phase up, we're a duplicate caller.
  // Return immediately so phase.fn() is invoked at most once across all
  // overlapping run() invocations.
  if (phase.status !== STATUS.PENDING) {
    return Promise.resolve();
  }
  // Dep gate — checked at the moment of execution, not at registration.
  // A missing dep, or a dep whose status is not DONE, marks this phase
  // SKIPPED and resolves immediately. The next phase still gets its turn.
  for (let i = 0; i < phase.deps.length; i++) {
    const depName = phase.deps[i];
    const dep = phases.get(depName);
    if (!dep || dep.status !== STATUS.DONE) {
      phase.status = STATUS.SKIPPED;
      phase.error = new Error('[Boot] phase "' + phase.name + '" skipped — dep "' + depName + '" ' + (dep ? 'status=' + dep.status : 'not registered'));
      return Promise.resolve();
    }
  }
  return new Promise<void>(function (resolve) {
    const go = function () {
      phase.status = STATUS.RUNNING;
      let result: unknown;
      try {
        result = phase.fn();
      } catch (err) {
        phase.status = STATUS.FAILED;
        phase.error = err as Error;
        console.error('[Boot] phase "' + phase.name + '" threw:', err);
        resolve();
        return;
      }
      // Phase.fn may return a thenable — wait for it. Sync return → already a resolved Promise.
      Promise.resolve(result).then(
        function () { phase.status = STATUS.DONE; resolve(); },
        function (err) {
          phase.status = STATUS.FAILED;
          phase.error = err as Error;
          console.error('[Boot] phase "' + phase.name + '" rejected:', err);
          resolve();
        }
      );
    };
    if (phase.delay > 0) {
      // Delayed phases use Runtime.setTimeout so they're tracked + cancellable
      // via App.Runtime.dispose() — Boot deliberately does not own its own
      // timer registry. This keeps the dependency direction Boot → Runtime.
      const R = getRuntime();
      if (R && typeof R.setTimeout === 'function') {
        R.setTimeout(go, phase.delay);
      } else {
        // Defensive fallback: native setTimeout if Runtime isn't there yet.
        // This shouldn't happen in production because run() is always called
        // after the deferred module loads, but keeps unit-tests hermetic.
        window.setTimeout(go, phase.delay);
      }
    } else {
      go();
    }
  });
}

function run(): Promise<void> {
  // Snapshot the PENDING set at call time. Phases registered after run()
  // starts but before it finishes are NOT picked up in this run — they wait
  // for the next run() call. This makes run() deterministic and re-entrant.
  const queue: BootPhase[] = [];
  phases.forEach(function (p) { if (p.status === STATUS.PENDING) queue.push(p); });
  return queue.reduce(function (chain: Promise<void>, p: BootPhase) {
    return chain.then(function () { return _runPhase(p); });
  }, Promise.resolve());
}

// Test / debug affordance — clear the registry.
function _reset(): void {
  phases.clear();
}

export const Boot: BootAPI = Object.freeze({
  register: register,
  run: run,
  status: status,
  STATUS: STATUS,
  _phases: phases,
  _reset: _reset,
});
