// ============================================================================
// Capsules render — barrel. Phase TS-14D.
//
// Capsules share the entire render path with clips through the shared
// /src/render/clips/ module. This module is a thin alias that:
//   - re-exports the shared types
//   - exposes a section-id constant
//   - provides `renderCapsulesView(deps)` = `renderVideoSectionView('capsules', deps)`
//
// No new code — just makes the per-section module structure complete and
// consistent with the rest of /src/render/.
// ============================================================================

import {
  renderVideoSectionView,
  buildVideoSectionView,
  type VideoDeps,
  type VideoItem,
  type VideoModel,
  type VideoViewResult,
} from '../clips';

export const CAPSULES_SECTION = 'capsules' as const;

export type CapsuleItem = VideoItem;
export type CapsuleModel = Omit<VideoModel, 'kind'>;
export type CapsuleViewResult = VideoViewResult;
export type CapsuleDeps = VideoDeps;

/** Render the capsules grid through the shared video-section pipeline. */
export function renderCapsulesView(deps: CapsuleDeps): void {
  renderVideoSectionView('capsules', deps);
}

/** Pure composition (test-only) — wraps buildVideoSectionView with the
 *  'capsules' kind so consumers don't need to remember the discriminator. */
export function buildCapsulesView(model: CapsuleModel, deps: CapsuleDeps): CapsuleViewResult {
  return buildVideoSectionView({ ...model, kind: 'capsules' }, deps);
}
