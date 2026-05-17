// ============================================================================
// App.Instrumentation — Phase 0.3 of the incremental modularization plan v3.
// Extracted to TypeScript in Phase TS-3.
//
// Passive sampled in-memory event ring. Provides a place for future modules
// to drop debug/observability events without touching console, network,
// localStorage, or any timer. NOT a telemetry SDK — never sends anything
// anywhere.
//
// PUBLIC SURFACE (all frozen via Object.freeze):
//   - record(kind, data?, opts?)   → boolean (true = stored, false = dropped)
//   - getBuffer()                  → frozen snapshot Array of events
//   - clear()                      → empties the internal buffer
//   - setEnabled(bool)             → opt-in. Throws on non-boolean.
//   - setSampleRate(rate)          → rate ∈ [0, 1]. Throws on invalid.
//   - STATUS                       → frozen enum (reserved namespace)
//   - _reset                       → test-only affordance
//
// DESIGN RULES (non-negotiable, per Phase 0.x discipline):
// - SILENT: zero console.* anywhere in this block, even on invalid input
//   or buffer overflow. record() must be safe to call from any handler.
//   Config setters DO throw on invalid type — throws aren't logs.
// - ZERO IO: no fetch/XHR/WebSocket/localStorage/IDB/postMessage.
// - ZERO TIMER: no setTimeout/setInterval/requestAnimationFrame. Date.now()
//   is the only time source.
// - ZERO CONSUMER: nothing inside the runtime calls record() in 0.3.
// - ZERO DOMAIN: no reference to Supabase, audio, state, profile, badges.
// - OPT-IN BY DEFAULT: enabled = false at load.
// - RING BUFFER: simple Array (max 200). On overflow, shift() the oldest.
// - PRIVATE INTERNAL STATE: buffer/enabled/sampleRate are closure-private.
//   getBuffer() returns a frozen snapshot (Object.freeze on a slice copy).
// - DETERMINISTIC OVERRIDE: record(kind, data, { force: true }) bypasses
//   sampling. force does NOT bypass enabled=false.
// ============================================================================

interface InstrumentationEvent {
  kind: string;
  ts: number;
  data: unknown;
}

interface RecordOptions {
  force?: boolean;
}

export interface InstrumentationAPI {
  record: (kind: string, data?: unknown, opts?: RecordOptions) => boolean;
  getBuffer: () => readonly InstrumentationEvent[];
  clear: () => void;
  setEnabled: (v: boolean) => void;
  setSampleRate: (rate: number) => void;
  STATUS: {
    readonly ENABLED: 'enabled';
    readonly DISABLED: 'disabled';
  };
  _reset: () => void;
}

const STATUS = Object.freeze({
  ENABLED: 'enabled' as const,
  DISABLED: 'disabled' as const,
});

const MAX_BUFFER = 200;

// Closure-private state. None of these references escape — see the
// public surface at the bottom, no key returns these directly.
let enabled = false;
let sampleRate = 1.0;
const buffer: InstrumentationEvent[] = [];

function record(kind: string, data?: unknown, opts?: RecordOptions): boolean {
  // Hard-stop: disabled is absolute. The `force` opt does NOT override it.
  if (!enabled) return false;
  if (typeof kind !== 'string' || kind.length === 0) return false;
  const force = !!(opts && opts.force === true);
  if (!force && Math.random() >= sampleRate) return false;
  if (buffer.length >= MAX_BUFFER) buffer.shift();
  buffer.push({ kind: kind, ts: Date.now(), data: data });
  return true;
}

function getBuffer(): readonly InstrumentationEvent[] {
  // Frozen shallow copy. External code cannot reach the live array,
  // and cannot mutate the returned snapshot. Event objects inside are
  // NOT deep-frozen (callers should treat as immutable, like React props).
  return Object.freeze(buffer.slice());
}

function clear(): void {
  buffer.length = 0;
}

function setEnabled(v: boolean): void {
  if (typeof v !== 'boolean') {
    throw new Error('[Instrumentation] setEnabled: arg must be boolean');
  }
  enabled = v;
}

function setSampleRate(rate: number): void {
  if (typeof rate !== 'number' || !isFinite(rate) || rate < 0 || rate > 1) {
    throw new Error('[Instrumentation] setSampleRate: arg must be a finite number in [0, 1]');
  }
  sampleRate = rate;
}

// Test affordance — same convention as Boot._reset. Resets ALL closure
// state (enabled, sampleRate, buffer) to construction defaults so smoke
// tests run hermetically. NEVER call from product code.
function _reset(): void {
  enabled = false;
  sampleRate = 1.0;
  buffer.length = 0;
}

export const Instrumentation: InstrumentationAPI = Object.freeze({
  record: record,
  getBuffer: getBuffer,
  clear: clear,
  setEnabled: setEnabled,
  setSampleRate: setSampleRate,
  STATUS: STATUS,
  _reset: _reset,
});
