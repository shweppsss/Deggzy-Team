// ============================================================================
// Video-section render — barrel (used by clips AND capsules). Phase TS-14C.
// ============================================================================
export type {
  VideoItem, VideoSectionKind, VideoSectionConfig, VideoModel, VideoViewResult, VideoDeps,
} from './types';
export { VIDEO_CONFIGS } from './types';
export { sortByAddedAtDesc, emptyTitle, emptyHint } from './calculations';
export { buildVideoCard } from './widgets/video-card';
export { buildVideoSectionView } from './composition';
export {
  renderVideoSectionView,
  registerVideoSectionSideEffects,
  type VideoSectionSideEffects,
} from './mount';
