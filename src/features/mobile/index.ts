// ============================================================================
// Mobile polish — barrel. Phase Mobile-1.
//
// Boot-time `registerMobile(deps?)` initializes haptics + visibility +
// transitions and (optionally) wires audio continuity to the player.
// ============================================================================

import { initHaptics } from './haptics';
import { initVisibility } from './visibility';
import { registerAudioContinuity, type AudioContinuityDeps } from './audio-continuity';

export type { HapticPattern } from './haptics';
export type { VisibilityState } from './visibility';
export type { AudioContinuityDeps } from './audio-continuity';
export {
  haptic, hapticMs, areHapticsEnabled, setHapticsEnabled, initHaptics,
  _resetHaptics, _forceReducedMotion,
} from './haptics';
export {
  getVisibilityState, subscribeVisibility, initVisibility, teardownVisibility,
  _forceVisibility, _getSubCount,
} from './visibility';
export {
  viewTransition, setTransitionsEnabled, areTransitionsEnabled, _resetTransitions,
} from './transitions';
export {
  registerAudioContinuity, _resetAudioContinuity,
} from './audio-continuity';

/** Wire every mobile sub-module. Pass `audioContinuity` to enable
 *  background→foreground audio resume. */
export function registerMobile(opts?: { audioContinuity?: AudioContinuityDeps }): void {
  initHaptics();
  initVisibility();
  if (opts && opts.audioContinuity) registerAudioContinuity(opts.audioContinuity);
}
