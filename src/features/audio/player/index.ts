// ============================================================================
// Mini-player orchestration — barrel. Phase TS-19.
//
// Single `registerPlayer(deps)` entry wires every sub-module to the same
// deps. Controllers + queue + playback + seek + media-session + recovery
// + element all share the same dep instance.
// ============================================================================

import type { PlayerDeps } from './types';
import { registerPlaybackDeps } from './playback';
import { registerSeekDeps } from './seek';
import { registerRecoveryDeps } from './recovery';
import { registerElementDeps } from './element';
import { bootController } from './controller';

export type { PlayerTrack, PlayerAudioRef, PlayerDeps, PlayerRecoverySnapshot, QueueEntry } from './types';
export {
  playTrack,
  pause,
  resume,
  stop,
  next,
  previous,
  seek,
  seekRatio,
  tryRecover,
  bootController,
  _isBooted,
  _resetController,
  _getIntentToken,
  _getListenerCount,
  Queue,
} from './controller';
export { setQueue, setCursor, peekNext, peekPrevious, _resetQueue, _getCursor } from './queue';
export { _getSeekToken, _resetSeek, seekToSeconds, seekToRatio } from './seek';
export { _resetPlayback, playUrl } from './playback';
export { _isInitialized as _isMediaSessionInitialized, _resetMediaSession, setMetadata as setMediaSessionMetadata, installActionHandlers } from './media-session';
export { captureSnapshot, readSnapshot } from './recovery';
export { attachOrchestration, detachOrchestration, _resetElement } from './element';

/** Wire all player sub-modules to the same deps. Call once at boot, after
 *  the audio element is mounted. */
export function registerPlayer(deps: PlayerDeps): void {
  registerPlaybackDeps(deps);
  registerSeekDeps(deps);
  registerRecoveryDeps(deps);
  registerElementDeps(deps);
  bootController(deps);
}
