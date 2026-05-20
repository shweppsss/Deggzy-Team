// ============================================================================
// Auth foundation — types. Phase TS-10.
//
// Strict unions for the local runtime auth state. Network/OAuth/signup
// shapes are intentionally NOT here — TS-10 scope is the local runtime
// (PIN + session + storage). Those belong to TS-11.
// ============================================================================

/** Supabase-shaped user — the subset the local runtime touches. */
export interface AuthUser {
  id: string;
  email?: string | null;
}

/** App profile (display name, role, photo) — the subset the local runtime touches. */
export interface AuthProfile {
  id?: string;
  name?: string;
  role?: string;
  pinHash?: string;
  createdAt?: string;
  lastLogin?: string;
}

/** PIN buffer / lock state — exposed for the UI to read between keypress events. */
export interface PinBufferState {
  buffer: string;
  /** Brief lock during the verify animation so a 5th press doesn't bleed in. */
  locked: boolean;
}

/** PIN failure-counter / lockout-deadline persisted in localStorage per-user. */
export interface PinLockState {
  count: number;
  lockedUntil: number;
  isLocked: boolean;
  remainingSec: number;
}

/** Strict typing of the lockout escalation thresholds (auth audit fix C). */
export interface PinLockoutThresholds {
  readonly W30S: number;
  readonly W5MIN: number;
  readonly W30MIN: number;
  readonly SIGNOUT: number;
}
