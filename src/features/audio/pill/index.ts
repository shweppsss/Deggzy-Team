// ============================================================================
// Audio pill — barrel. Phase TS-20.
//
// Final piece of the audio domain. The catalogue + detail renderers now
// consume `buildTrackAudioInitialHTML` directly; the store-driven sync
// reconciles every pill in the DOM via `syncAllPills` (registered as a
// subscriber of the TS-17 audio store in /src/main.ts).
// ============================================================================

export type { PillTrack, PillAudioState } from './types';
export { PLAY_ICON_SVG, PAUSE_ICON_SVG } from './icons';
export { formatAudioTime } from './format';
export { buildTrackAudioPillHTML, buildTrackAudioInitialHTML } from './html';
export { syncAllPills } from './sync';
