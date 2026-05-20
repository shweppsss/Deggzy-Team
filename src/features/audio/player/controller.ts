// ============================================================================
// Mini-player controller — the only public entry point for playback intent.
// Phase TS-19.
//
// Pattern:
//
//   Intent (playTrack/pause/resume/seek/next/previous)
//     ↓
//   Controller (orchestrates queue + cache + UI side-effects)
//     ↓
//   Playback (token-protected audio element ops)
//     ↓
//   AudioStore (TS-17) mirrors state for the rest of the app
//
// The controller stays SYNCHRONOUS on the hot path between user gesture and
// audio.play(): a cached URL is peeked synchronously and play() fires
// immediately. Cold misses fall through to an async resolve.
// ============================================================================

import type { PlayerDeps, PlayerTrack } from './types';
import { playUrl, pause as playbackPause, resume as playbackResume, stop as playbackStop, _getIntentToken } from './playback';
import { seekToSeconds, seekToRatio } from './seek';
import { installActionHandlers, setMetadata } from './media-session';
import { attachOrchestration, detachOrchestration, _getListenerCount } from './element';
import { captureSnapshot, readSnapshot } from './recovery';
import * as Q from './queue';

let _deps: PlayerDeps | null = null;
let _booted = false;

/** Register controller deps + wire orchestration listeners + mediaSession. */
export function bootController(deps: PlayerDeps): void {
  _deps = deps;
  if (_booted) return;
  _booted = true;

  attachOrchestration({
    onEnded: () => {
      // Autoplay-next on track end. If no next, stay paused at 0.
      const nextId = Q.peekNext();
      if (nextId) playTrack(nextId);
    },
    onTimeUpdate: () => {
      const id = deps.getActiveTrackId();
      if (!id) return;
      const audio = deps.getAudioEl();
      if (!audio) return;
      captureSnapshot(id, audio.currentTime, !audio.paused);
    },
  });

  installActionHandlers({
    play: () => resume(),
    pause: () => pause(),
    seekBackward: (s) => {
      const a = deps.getAudioEl();
      if (a) seekToSeconds(Math.max(0, (a.currentTime || 0) - s));
    },
    seekForward: (s) => {
      const a = deps.getAudioEl();
      if (a) seekToSeconds((a.currentTime || 0) + s);
    },
    seekTo: (s) => { seekToSeconds(s); },
    nextTrack: () => next(),
    previousTrack: () => previous(),
  });
}

/** Test hook: read boot state. */
export function _isBooted(): boolean { return _booted; }

/** Test hook: reset controller (without touching deps' state). */
export function _resetController(): void {
  detachOrchestration();
  _booted = false;
}

// ---------------------------------------------------------------------------
// Public intent surface
// ---------------------------------------------------------------------------

/**
 * Play the given track. Synchronous on cache hit (preserves user gesture);
 * falls through to an async resolve on miss. Same-track tap toggles
 * pause/resume on the existing playback.
 */
export function playTrack(trackId: string): void {
  if (!_deps) return;
  const activeId = _deps.getActiveTrackId();
  if (activeId === trackId) {
    const audio = _deps.getAudioEl();
    if (audio) {
      if (audio.paused) playbackResume();
      else playbackPause();
      return;
    }
  }
  const track = _deps.findTrack(trackId);
  if (!track) return;
  Q.setCursor(trackId);
  const cached = _deps.peekAudio(trackId);
  if (cached && cached.url) {
    const coverUrl = _deps.peekCover(trackId);
    _showMetadata(track, coverUrl);
    if (!coverUrl) {
      _deps.resolveCover(trackId).then((u) => {
        if (u && _deps && _deps.getActiveTrackId() === trackId) _deps.applyCover(u);
      }).catch(() => {});
    }
    _deps.setAudioState({ trackId: track.id, currentTime: 0, duration: 0, loading: true });
    playUrl(cached.url);
    return;
  }
  // Cold miss — async resolve. iOS gesture is already gone by the time we
  // get here, so play() may be rejected; the AudioStore reflects the failure.
  _resolveAndPlay(trackId);
}

async function _resolveAndPlay(trackId: string): Promise<void> {
  if (!_deps) return;
  const track = _deps.findTrack(trackId);
  if (!track) return;
  const audioRef = await _deps.resolveAudio(trackId);
  if (!audioRef || !audioRef.url) {
    _deps.toast("Audio introuvable — recharge l'app.");
    return;
  }
  let coverUrl: string | null = null;
  try { coverUrl = await _deps.resolveCover(trackId); } catch { /* ignore */ }
  _showMetadata(track, coverUrl);
  _deps.setAudioState({ trackId: track.id, currentTime: 0, duration: 0, loading: true });
  playUrl(audioRef.url);
}

function _showMetadata(track: PlayerTrack, coverUrl: string | null): void {
  if (!_deps) return;
  _deps.applyMetadata(track, coverUrl);
  const title = track.name || 'Sans titre';
  const subtitle = (track.feat ? track.feat : 'Noname');
  setMetadata(title, subtitle, coverUrl);
}

/** Pause current playback. */
export function pause(): void {
  playbackPause();
}

/** Resume current playback. */
export function resume(): void {
  playbackResume();
}

/** Stop + clear src (used by hide()). */
export function stop(): void {
  playbackStop();
  if (_deps) {
    _deps.setAudioState({ trackId: null, isPlaying: false, currentTime: 0, duration: 0, loading: false });
  }
}

/** Skip to the next track in the queue (no-op if at tail). */
export function next(): void {
  const id = Q.peekNext();
  if (id) playTrack(id);
}

/** Skip to the previous track in the queue (no-op if at head). */
export function previous(): void {
  const id = Q.peekPrevious();
  if (id) playTrack(id);
}

/** Scrub to a seconds value. */
export function seek(seconds: number): void {
  seekToSeconds(seconds);
}

/** Scrub by a 0..1 ratio of the current duration. */
export function seekRatio(ratio: number): void {
  seekToRatio(ratio);
}

/**
 * Read the persisted snapshot and apply currentTime to a freshly loaded
 * track. Does NOT auto-play (iOS Safari blocks playback outside a user
 * gesture). Returns true if a snapshot was applied.
 */
export function tryRecover(): boolean {
  if (!_deps) return false;
  const snap = readSnapshot();
  if (!snap) return false;
  const track = _deps.findTrack(snap.trackId);
  if (!track) return false;
  // We don't issue a play intent — but we DO seed the store so the rest
  // of the UI knows which track is "active" for highlighting.
  _deps.setAudioState({ trackId: snap.trackId, currentTime: snap.currentTime, loading: false });
  return true;
}

// ---------------------------------------------------------------------------
// Test introspection re-exports
// ---------------------------------------------------------------------------
export { _getIntentToken, _getListenerCount };
export * as Queue from './queue';
