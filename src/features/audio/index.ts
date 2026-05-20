// ============================================================================
// Audio feature — barrel. Phase TS-17.
//
// Currently exports the audio state store. Future migrations (cache/IDB,
// cover store, prewarm, hydrate, playTrackInMini orchestration) will land
// behind the same barrel.
// ============================================================================

export type { AudioState, AudioStateSubscriber } from './state';
export {
  getAudioState,
  subscribeAudio,
  setAudioState,
  hookAudioToStore,
  _resetAudioStore,
  _getSubscriberCount,
} from './state';
