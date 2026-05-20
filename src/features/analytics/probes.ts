// ============================================================================
// Probes — typed instrumentation helpers for the 4 orchestrators.
// Phase Analytics-1.
//
// Each helper is a thin wrapper around track() with a fixed category.
// Call sites express intent and pass meta — no remembering the
// category/action vocabulary at the call site.
// ============================================================================

import { track } from './sink';

// SAVE pipeline -------------------------------------------------------------
export const probeSave = {
  start: (meta?: Record<string, unknown>) => track('save', 'start', meta),
  success: (durationMs: number, meta?: Record<string, unknown>) => track('save', 'success', meta, durationMs),
  failure: (reason: string, meta?: Record<string, unknown>) => track('save', 'failure', { reason, ...(meta || {}) }),
  cloudPushFailure: (reason: string, meta?: Record<string, unknown>) => track('save', 'cloud_push_failure', { reason, ...(meta || {}) }),
};

// AUDIO controller ----------------------------------------------------------
export const probeAudio = {
  play: (trackId: string) => track('audio', 'play', { trackId }),
  pause: (trackId: string | null) => track('audio', 'pause', { trackId }),
  ended: (trackId: string | null) => track('audio', 'ended', { trackId }),
  error: (trackId: string | null, message: string) => track('audio', 'error', { trackId, message }),
  seek: (trackId: string | null, toSeconds: number) => track('audio', 'seek', { trackId }, toSeconds),
  resolveFailure: (trackId: string) => track('audio', 'resolve_failure', { trackId }),
};

// RENDER dispatch -----------------------------------------------------------
export const probeRender = {
  pass: (route: string, durationMs: number, sectionCount: number) =>
    track('render', 'pass', { route, sectionCount }, durationMs),
  sectionInvalidated: (sectionId: string, reason: string) =>
    track('render', 'section_invalidated', { sectionId, reason }),
  routeChange: (from: string, to: string) =>
    track('render', 'route_change', { from, to }),
};

// TRACK mutations -----------------------------------------------------------
export const probeTracks = {
  create: (id: string) => track('tracks', 'create', { id }),
  update: (id: string, field: string) => track('tracks', 'update', { id, field }),
  delete: (id: string, source: 'menu' | 'swipe' | 'detail') => track('tracks', 'delete', { id, source }),
  rollback: (op: string, reason: string) => track('tracks', 'rollback', { op, reason }),
  audioCleared: (id: string) => track('tracks', 'audio_cleared', { id }),
};

// OFFLINE -------------------------------------------------------------------
export const probeOffline = {
  connectivity: (status: 'online' | 'offline') => track('offline', 'connectivity', { status }),
  replayStart: () => track('offline', 'replay_start'),
  replaySuccess: () => track('offline', 'replay_success'),
  replayFailure: (reason: string) => track('offline', 'replay_failure', { reason }),
};

// REALTIME ------------------------------------------------------------------
export const probeRealtime = {
  presenceCount: (count: number) => track('realtime', 'presence_count', undefined, count),
  activityReceived: (kind: string, actorId: string) => track('realtime', 'activity_received', { kind, actorId }),
  activitySent: (kind: string) => track('realtime', 'activity_sent', { kind }),
};

// MOBILE / VISIBILITY --------------------------------------------------------
export const probeMobile = {
  visibility: (state: 'visible' | 'hidden') => track('mobile', 'visibility', { state }),
  audioResume: () => track('mobile', 'audio_resume'),
};

// GENERIC ERROR --------------------------------------------------------------
export const probeError = {
  caught: (where: string, message: string) => track('error', 'caught', { where, message }),
  rejection: (where: string, message: string) => track('error', 'unhandled_rejection', { where, message }),
};
