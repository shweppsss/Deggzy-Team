// ============================================================================
// Realtime collab — shared types. Phase Realtime-1.
//
// Supabase realtime channels in this codebase carry two kinds of payloads:
//   1. PRESENCE — who's online (existing, inline-managed)
//   2. BROADCAST — ad-hoc events ("user X added a track")
//
// This module wraps both behind typed surfaces so other features can
// subscribe without touching Supabase directly. The inline presence
// channel keeps running; we read from it via the deps `getPresenceMap`.
// New broadcast events flow through a separate channel managed here.
// ============================================================================

/** Public identity surfaced in presence + activity events. */
export interface PresenceUser {
  id: string;
  name: string;
  role?: string;
  avatarUrl?: string;
}

/** Broadcast event payloads. Extensible by adding to the union. */
export type ActivityEventKind =
  | 'track:added'
  | 'track:updated'
  | 'track:deleted'
  | 'event:added'
  | 'event:moved'
  | 'event:deleted'
  | 'todo:added'
  | 'todo:completed'
  | 'inspi:added';

export interface ActivityEvent {
  /** Monotonically increasing id per session. */
  id: string;
  kind: ActivityEventKind;
  /** Who fired the event (snapshot of the actor at fire time). */
  actor: PresenceUser;
  /** Entity id the event refers to (optional — useful for grouping). */
  entityId?: string;
  /** Free-form human-readable summary. */
  summary: string;
  /** ISO timestamp. */
  at: string;
}

/** Minimal channel shape we use from Supabase realtime. The harness
 *  provides a mock that satisfies this. */
export interface RealtimeChannel {
  on(event: string, opts: unknown, fn: (payload: unknown) => void): RealtimeChannel;
  send(payload: { type: string; event: string; payload: unknown }): Promise<unknown> | unknown;
  subscribe(cb?: (status: string) => void): RealtimeChannel;
  unsubscribe(): Promise<unknown> | unknown;
}

export interface RealtimeDeps {
  /** Create or join a realtime channel by name. */
  createChannel: (name: string, opts?: { config?: unknown }) => RealtimeChannel;
  /** Read the current user's identity for actor stamps. */
  getActor: () => PresenceUser | null;
  /** Optional: read the existing inline presence map keyed by userId. */
  getPresenceMap?: () => Record<string, PresenceUser> | null;
  /** Optional toast on errors. */
  toast?: (msg: string) => void;
}
