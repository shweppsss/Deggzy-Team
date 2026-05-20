// ============================================================================
// Track CRUD — barrel. Phase TS-21.
//
// Single `registerTracks(deps)` entry point wires every sub-module to the
// same deps. Validation + factory stay PURE (no deps). Mutations carry
// the orchestration.
// ============================================================================

export type { Track, TrackCreatePatch, TrackUpdatePatch, TrackDeps } from './types';
export { TRACK_DEFAULTS, buildNewTrack } from './factory';
export { isAllowedField, isValidId, sanitizePatch } from './validation';
export {
  registerTrackDeps,
  createTrack,
  updateTrackField,
  updateTrack,
  deleteTrack,
  deleteTrackDetail,
  swipeDeleteTrack,
  clearAudio,
} from './mutations';

import type { TrackDeps } from './types';
import { registerTrackDeps as _register } from './mutations';

/** Wire every sub-module to the same deps. Call once at boot. */
export function registerTracks(deps: TrackDeps): void {
  _register(deps);
}
