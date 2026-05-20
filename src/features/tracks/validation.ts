// ============================================================================
// Track field validation — PURE. Phase TS-21.
//
// The catalogue lets the user edit fields directly via input controls. The
// inline `updateTrackField(id, field, v)` accepted any field/value blindly.
// This module adds light validation:
//   - reject empty/whitespace `id`
//   - drop unknown fields (silent — frontend should never send them)
//   - coerce undefined/null patch fields to safe defaults
//   - reject field=='id' (id is immutable)
//
// The validator does NOT enforce business rules (e.g. "duration must be
// m:ss") because the legacy UI lets the user type free-form. The goal is
// just to keep the in-memory state shape consistent.
// ============================================================================

import type { TrackUpdatePatch } from './types';

const ALLOWED_FIELDS: ReadonlySet<string> = new Set([
  'name', 'releaseDate', 'status', 'bpm', 'duration', 'feat', 'notes',
  'cover', 'audio', 'idbAudio', 'idbCover', 'audioMeta',
  'sbAudioPath', 'sbCoverPath',
  // Pass-through for any other future field added in production rows.
]);

/** Returns true if `field` may be assigned. `id` is rejected outright. */
export function isAllowedField(field: string): boolean {
  if (typeof field !== 'string' || field === 'id') return false;
  return ALLOWED_FIELDS.has(field);
}

/**
 * Filter an update patch down to allowed fields. Returns a NEW object —
 * the caller's input is never mutated.
 */
export function sanitizePatch(patch: TrackUpdatePatch): TrackUpdatePatch {
  const out: TrackUpdatePatch = {};
  if (!patch || typeof patch !== 'object') return out;
  for (const k of Object.keys(patch)) {
    if (isAllowedField(k)) {
      (out as Record<string, unknown>)[k] = (patch as Record<string, unknown>)[k];
    }
  }
  return out;
}

/** True iff `id` is a usable non-empty trimmed string. */
export function isValidId(id: unknown): id is string {
  return typeof id === 'string' && id.trim() === id && id.length > 0;
}
