// ============================================================================
// Prewarm — best-effort preload of every track that has IDB audio. Phase TS-18.
//
// Idle-scheduled so we don't compete with the initial paint. Failures are
// swallowed silently — prewarm is opportunistic; the user-initiated play
// path always re-tries.
// ============================================================================

import type { AudioCacheDeps } from './types';
import { getTrackAudioUrl } from './urls';

let _deps: AudioCacheDeps | null = null;

export function registerPrewarmDeps(deps: AudioCacheDeps): void {
  _deps = deps;
}

/**
 * Warm `_audioCache` for every track that has either an `idbAudio` flag or
 * a legacy `data:` URL audio field. Concurrent invocations are de-duped by
 * the underlying `getTrackAudioUrl` in-flight tracking.
 */
export function prewarmAudioCache(): void {
  if (!_deps) return;
  const tracks = _deps.getTracks().filter((t) =>
    !!(t && (t.idbAudio || (t.audio && typeof t.audio === 'string' && t.audio.startsWith('data:'))))
  );
  if (!tracks.length) return;
  const tick = (): void => {
    for (const t of tracks) {
      getTrackAudioUrl(t.id).catch(() => { /* opportunistic */ });
    }
  };
  const w = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
  if (typeof w.requestIdleCallback === 'function') {
    w.requestIdleCallback(tick, { timeout: 2000 });
  } else {
    setTimeout(tick, 600);
  }
}
