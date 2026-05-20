// ============================================================================
// Analytics + monitoring — shared types. Phase Analytics-1.
//
// The four centralized orchestrators ship events through this module:
//   1. SAVE pipeline      → save:* (start, success, failure)
//   2. AUDIO controller    → audio:* (play, pause, seek, ended, error)
//   3. RENDER dispatch     → render:* (route, section invalidated, pass)
//   4. TRACK mutations     → tracks:* (create, update, delete, rollback)
//
// All events flow into a single sink. The default sink is a bounded
// in-memory ring buffer (queryable via getRecentEvents()). A sender hook
// can be plugged in to forward to Supabase / Sentry / a custom endpoint.
// ============================================================================

export type AnalyticsEventCategory = 'save' | 'audio' | 'render' | 'tracks' | 'auth' | 'offline' | 'realtime' | 'mobile' | 'error';

export interface AnalyticsEvent {
  /** Category prefix (lets the sink filter cheaply). */
  category: AnalyticsEventCategory;
  /** Action name within the category (e.g. 'success', 'failure', 'play'). */
  action: string;
  /** Optional numeric value (duration ms, byte count, etc.). */
  value?: number;
  /** Free-form metadata. Stays in-memory; the sender hook decides what to forward. */
  meta?: Record<string, unknown>;
  /** Monotonically-increasing per-session id. */
  id: number;
  /** ISO timestamp. */
  at: string;
}

export interface AnalyticsDeps {
  /** Optional forwarder. Called for every event AFTER it lands in the buffer.
   *  Throwing here is harmless — caught + logged. */
  send?: (event: AnalyticsEvent) => void;
  /** Override the default 500-event ring buffer cap. */
  bufferSize?: number;
}
