// ============================================================================
// Legacy bridge — typed accessors for inline state/helpers not yet migrated. TS-8.
//
// PURPOSE
// -------
// As the migration progresses, some inline helpers + the global `state`
// object haven't yet been migrated to TS. Domain modules under
// `/src/features/<X>/` SHOULD NOT reach into `window` directly — that
// creates an invisible coupling that defeats the whole point of the
// migration.
//
// This file is the SINGLE allowed bridge point. Domain modules import
// from here when they need a still-inline helper / state slice; this
// file does the `window` lookup with a typed signature, a `typeof` /
// `Array.isArray` guard, and a safe fallback.
//
// When the inline helper itself migrates to TS, the bridge function in
// this file gets replaced by a real `import` and the call sites stay
// unchanged.
//
// DESIGN RULES:
// - This is the ONLY place under `/src/` (outside `main.ts`) allowed to
//   read `window.X` for legacy state/helpers. Domain modules must NOT.
// - Every bridge function has a typed signature and a graceful fallback.
// - Each bridged item has a comment pointing to its migration roadmap
//   entry, so the residual surface stays visible.
// ============================================================================

// ---------------------------------------------------------------------------
// Entity shapes — keep them loose (every field optional) because they
// describe legacy data the type-checker has no way to verify.
// ---------------------------------------------------------------------------
export interface BridgedEntity {
  id: string;
  [key: string]: unknown;
}

export interface BridgedState {
  events?: BridgedEntity[];
  tracks?: BridgedEntity[];
  todos?: BridgedEntity[];
  inspirations?: BridgedEntity[];
  team?: BridgedEntity[];
}

interface AudioData {
  url: string;
  name: string;
  size: number;
}

interface BridgedWindow {
  // App state — migration: pending state-store extraction.
  state?: BridgedState;
  // Strategic phase registry — migration: pending phase-domain extraction.
  PHASES?: Record<string, unknown>;
  // Active-view re-dispatch — migration: pending router extraction.
  renderView?: (name: string) => void;
  // IDB blob URL accessors — migration: pending storage extraction.
  getTrackCoverUrl?: (id: string) => Promise<string | null | undefined>;
  getTrackAudioUrl?: (id: string) => Promise<AudioData | null | undefined>;
  // Audio store-dependent inline helpers — migration: pending audio-store extraction.
  _trackAudioPillHTML?: (t: unknown, durationLabel?: string) => string;
  formatBytes?: (n: number) => string;
  _formatAudioTime?: (s: number) => string;
}

function w(): BridgedWindow {
  return window as unknown as BridgedWindow;
}

// ---------------------------------------------------------------------------
// State accessors — return either the live legacy object or a safe empty
// snapshot. Domain modules treat the result as readonly.
// ---------------------------------------------------------------------------

export function getLegacyState(): BridgedState {
  return w().state || {};
}

export function getLegacyPhases(): Record<string, unknown> {
  return w().PHASES || {};
}

export function callLegacyRenderView(name: string): void {
  const fn = w().renderView;
  if (typeof fn === 'function') fn(name);
}

// ---------------------------------------------------------------------------
// IDB blob URL accessors — used by hydrate.ts.
// ---------------------------------------------------------------------------

export async function fetchTrackCoverUrl(id: string): Promise<string | null | undefined> {
  const fn = w().getTrackCoverUrl;
  if (typeof fn !== 'function') return null;
  return fn(id);
}

export async function fetchTrackAudioUrl(id: string): Promise<AudioData | null | undefined> {
  const fn = w().getTrackAudioUrl;
  if (typeof fn !== 'function') return null;
  return fn(id);
}

// ---------------------------------------------------------------------------
// Audio store-dependent helpers — migration pending.
// ---------------------------------------------------------------------------

/**
 * Render the audio pill (play/pause + progress + time) for a track.
 * Reads the inline `_audioState` store. Falls back to '' if the helper
 * isn't yet defined.
 */
export function trackAudioPillHTML(t: unknown, durationLabel?: string): string {
  const fn = w()._trackAudioPillHTML;
  return typeof fn === 'function' ? fn(t, durationLabel) : '';
}

/** Humanize byte count ("1.2 MB" / "850 KB"). Empty string fallback. */
export function formatBytes(n: number): string {
  const fn = w().formatBytes;
  return typeof fn === 'function' ? fn(n) : '';
}

/** Humanize audio duration ("3:24"). Empty string fallback. */
export function formatAudioTime(seconds: number): string {
  const fn = w()._formatAudioTime;
  return typeof fn === 'function' ? fn(seconds) : '';
}
