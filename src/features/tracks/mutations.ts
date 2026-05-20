// ============================================================================
// Track mutations — orchestration. Phase TS-21.
//
// Every mutation goes through one of these intent functions. They:
//   1. validate
//   2. snapshot the previous state (for rollback)
//   3. apply the patch
//   4. fire side-effects (cache cleanup, IDB delete, save, render)
//   5. on synchronous save() throw → roll back state.tracks
//
// `save()` failures from the legacy code path are async (Supabase upload
// failure surfaces as a console.warn). Rollback here covers the
// SYNCHRONOUS failure mode only (e.g. a pre-save guard throws). Async
// upload retry is the cloud sync's responsibility.
// ============================================================================

import type { Track, TrackCreatePatch, TrackUpdatePatch, TrackDeps } from './types';
import { buildNewTrack } from './factory';
import { isAllowedField, sanitizePatch, isValidId } from './validation';

let _deps: TrackDeps | null = null;

export function registerTrackDeps(deps: TrackDeps): void {
  _deps = deps;
}

/** Internal: snapshot + try mutation + rollback on synchronous throw. */
function withRollback(fn: () => void): boolean {
  if (!_deps) return false;
  const snapshot = _deps.getTracks().slice();
  try {
    fn();
    return true;
  } catch (e) {
    console.warn('[tracks] mutation failed, rolling back:', e);
    _deps.replaceTracks(snapshot);
    return false;
  }
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

/**
 * Add a new track to state.tracks with the inline defaults. The optional
 * `patch` overrides specific fields (used by future flows; addTrack()'s
 * legacy call site passes nothing).
 *
 * Returns the new track id (or null if no deps registered).
 */
export function createTrack(patch?: TrackCreatePatch): string | null {
  if (!_deps) return null;
  const safePatch = patch ? sanitizePatch(patch) : {};
  const now = _deps.now || Date.now;
  const track = buildNewTrack(safePatch, now);
  const tracks = _deps.getTracks().slice();
  const ok = withRollback(() => {
    tracks.push(track);
    _deps!.replaceTracks(tracks);
    _deps!.save();
    _deps!.renderCatalogue();
  });
  return ok ? track.id : null;
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

/**
 * Write `value` to a single field on the track with id `id`. Silent no-op
 * if the track doesn't exist or the field isn't allowed.
 */
export function updateTrackField(id: string, field: string, value: unknown): boolean {
  if (!_deps) return false;
  if (!isValidId(id) || !isAllowedField(field)) return false;
  const tracks = _deps.getTracks();
  const t = tracks.find((x) => x.id === id);
  if (!t) return false;
  return withRollback(() => {
    (t as Record<string, unknown>)[field] = value;
    _deps!.save();
  });
}

/**
 * Bulk-patch helper. Same semantics as updateTrackField but applies a set
 * of fields atomically. Returns true on success, false if track missing.
 */
export function updateTrack(id: string, patch: TrackUpdatePatch): boolean {
  if (!_deps) return false;
  if (!isValidId(id)) return false;
  const tracks = _deps.getTracks();
  const t = tracks.find((x) => x.id === id);
  if (!t) return false;
  const safe = sanitizePatch(patch);
  return withRollback(() => {
    Object.assign(t, safe);
    _deps!.save();
  });
}

// ---------------------------------------------------------------------------
// DELETE (with confirm)
// ---------------------------------------------------------------------------

/**
 * Confirm-then-delete a track. Used by the catalogue card menu. Returns
 * true if the deletion went through (confirm accepted + track existed).
 */
export function deleteTrack(id: string): boolean {
  if (!_deps) return false;
  if (!isValidId(id)) return false;
  if (!_deps.confirm('Supprimer ce morceau ?')) return false;
  return _deleteTrackUnconditional(id);
}

/** Delete from the detail overlay. Same flow + closes the detail pane +
 *  re-renders every section instead of just the catalogue. */
export function deleteTrackDetail(id: string): boolean {
  if (!_deps) return false;
  if (!isValidId(id)) return false;
  if (!_deps.confirm('Supprimer ce morceau ?')) return false;
  if (!_deps.getTracks().some((t) => t.id === id)) return false;
  return withRollback(() => {
    _deps!.replaceTracks(_deps!.getTracks().filter((t) => t.id !== id));
    _deps!.save();
    _deps!.closeDetail();
    _deps!.renderAll();
    // Cache cleanup is fire-and-forget; failures here don't roll back.
    _cleanupTrackResources(id);
  });
}

// ---------------------------------------------------------------------------
// DELETE (silent — swipe is the confirmation)
// ---------------------------------------------------------------------------

/**
 * Delete WITHOUT a confirm prompt. Used by the swipe-to-delete handler
 * where the swipe itself was the confirmation. Toasts on success.
 */
export function swipeDeleteTrack(id: string): boolean {
  if (!_deps) return false;
  if (!isValidId(id)) return false;
  if (!_deps.getTracks().some((t) => t.id === id)) return false;
  const ok = _deleteTrackUnconditional(id);
  if (ok) _deps.toast('Morceau supprimé.');
  return ok;
}

// ---------------------------------------------------------------------------
// CLEAR AUDIO (track row stays; just unloads the audio sub-resource)
// ---------------------------------------------------------------------------

/**
 * Remove the audio blob from a track but keep the row itself. Idempotent:
 * calling on a track without audio is a no-op.
 */
export async function clearAudio(id: string): Promise<boolean> {
  if (!_deps) return false;
  if (!isValidId(id)) return false;
  const t = _deps.getTracks().find((x) => x.id === id);
  if (!t) return false;
  if (!_deps.confirm("Retirer l'audio de ce morceau ?")) return false;
  const ok = withRollback(() => {
    t.audio = null;
    if (t.idbAudio) {
      // IDB delete is fire-and-forget; failure doesn't roll back local state.
      _deps!.idbDeleteAudio('track_' + id).catch(() => { /* logged in cache layer */ });
      t.idbAudio = false;
      t.audioMeta = null;
      _deps!.clearAudioCache(id);
    }
    _deps!.save();
    _deps!.renderCatalogue();
  });
  if (ok) _deps.toast('Audio retiré.');
  return ok;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _deleteTrackUnconditional(id: string): boolean {
  if (!_deps) return false;
  return withRollback(() => {
    _deps!.replaceTracks(_deps!.getTracks().filter((t) => t.id !== id));
    _deps!.save();
    _deps!.renderCatalogue();
    _cleanupTrackResources(id);
  });
}

/** Fire-and-forget cache + IDB cleanup. Async failures don't bubble. */
function _cleanupTrackResources(id: string): void {
  if (!_deps) return;
  _deps.idbDeleteAudio('track_' + id).catch(() => { /* logged in cache layer */ });
  _deps.idbDeleteCover(id).catch(() => { /* logged in cache layer */ });
  _deps.clearAudioCache(id);
  _deps.clearCoverCache(id);
}
