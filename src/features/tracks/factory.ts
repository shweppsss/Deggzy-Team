// ============================================================================
// Track factory — PURE. Phase TS-21.
//
// Builds a fresh `Track` row with safe defaults. The `now()` clock and
// the optional patch are the only inputs — output is deterministic for
// the same inputs.
// ============================================================================

import type { Track, TrackCreatePatch } from './types';

/** Default values applied to a newly-created track. Mirrors the inline
 *  `addTrack()` behaviour exactly. */
export const TRACK_DEFAULTS: Readonly<Omit<Track, 'id'>> = Object.freeze({
  name: 'Nouveau morceau',
  releaseDate: '',
  status: 'produit',
  bpm: '',
  duration: '',
  feat: '',
  notes: '',
  cover: null,
  audio: null,
});

/**
 * Build a fresh track row. `now()` provides the timestamp used in the id
 * — injected so tests can pin the id deterministically.
 *
 * Pattern:
 *   buildNewTrack({ name: 'Custom' }, () => 1700000000000)
 *     → { id: 't1700000000000', name: 'Custom', ... defaults }
 */
export function buildNewTrack(
  patch?: TrackCreatePatch,
  now: () => number = Date.now,
): Track {
  const id = 't' + now();
  return Object.assign({}, TRACK_DEFAULTS, patch || {}, { id }) as Track;
}
