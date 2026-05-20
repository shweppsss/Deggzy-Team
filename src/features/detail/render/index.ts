// ============================================================================
// Detail renderers — barrel. Phase TS-7.
//
// Re-exports the 6 per-kind renderers + the shared deps interface and the
// audio-slot helper used by hydrate.ts. NOT re-exported on `window` —
// these are internal to the detail feature module and called only from
// lifecycle.ts (and hydrate.ts for renderAudioInitial).
// ============================================================================

export type { RenderDeps } from './shared';
export { getRenderDeps } from './shared';

export type { EventEntity, EventRenderContext } from './event';
export { renderEvent } from './event';

export type { TrackEntity, TrackRenderContext } from './track';
export { renderTrack, renderAudioInitial } from './track';

export type { TodoEntity } from './todo';
export { renderTodo } from './todo';

export type { InspiEntity } from './inspi';
export { renderInspi } from './inspi';

export type { MemberEntity } from './member';
export { renderMember } from './member';

export type { PhaseEntity, PhaseRenderContext } from './phase';
export { renderPhase } from './phase';
