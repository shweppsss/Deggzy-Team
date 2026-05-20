// ============================================================================
// MiniPlayer — VIEW layer for the "now playing" pill. Phase TS-19.
//
// Pre-TS-19 this module owned both the DOM and the playback orchestration
// (audio.src swap, audio.play(), mediaSession metadata). TS-19 split those
// concerns: the controller in /src/features/audio/player/ now owns
// playback intent and race protection; this module is now JUST the
// title/sub/cover view + the click handlers that translate user gestures
// into controller intents.
//
// PUBLIC SURFACE:
//   - init()                            → idempotent: wire DOM listeners
//   - show(track, audioUrl, coverUrl)   → legacy: applyMetadata + playUrl
//                                         (kept for inline callers that
//                                         haven't migrated to controller)
//   - applyMetadata(track, coverUrl)    → update title/sub/cover-bg + hidden=false
//   - applyCover(url)                   → update ONLY the cover backgroundImage
//   - hide()                            → stop + clear src + hidden=true
//
// DEPENDENCIES:
//   - hookAudioToStore + setAudioState — from /src/features/audio (TS-17)
//   - playUrl + stop                   — from /src/features/audio/player (TS-19)
//   - playTrack                        — from /src/features/audio/player (TS-19)
//   - icon()                           — from /src/lib/render-utils
//   - statusLabel, openDetail          — still bare globals (legacy)
// ============================================================================

import { icon } from '../lib/render-utils';
import { hookAudioToStore } from './audio';
import { playUrl, stop as playerStop, playTrack, pause as playerPause, resume as playerResume, seekToRatio } from './audio/player';

interface MiniPlayerTrack {
  id: string;
  name?: string;
  status?: string;
  feat?: string;
}

export interface MiniPlayerAPI {
  init: () => void;
  show: (track: MiniPlayerTrack, audioUrl: string, coverUrl?: string) => void;
  applyMetadata: (track: MiniPlayerTrack, coverUrl: string | null) => void;
  applyCover: (url: string) => void;
  hide: () => void;
}

type Win = Window & {
  statusLabel?: (status?: string) => string;
  openDetail?: (kind: string, id: string) => void;
};

function w(): Win {
  return window as unknown as Win;
}

let el: HTMLElement | null = null;
let audio: HTMLAudioElement | null = null;
let fill: HTMLElement | null = null;
let playBtn: HTMLElement | null = null;
let coverBtn: HTMLElement | null = null;
let titleEl: HTMLElement | null = null;
let subEl: HTMLElement | null = null;
let closeBtn: HTMLElement | null = null;
let currentTrackId: string | null = null;
let initialized = false;

function init(): void {
  if (initialized) return;
  el = document.getElementById('miniPlayer');
  if (!el) return;
  audio = document.getElementById('miniPlayerAudio') as HTMLAudioElement | null;
  fill = document.getElementById('miniPlayerFill');
  playBtn = document.getElementById('miniPlayerPlay');
  coverBtn = document.getElementById('miniPlayerCover');
  titleEl = document.getElementById('miniPlayerTitle');
  subEl = document.getElementById('miniPlayerSub');
  closeBtn = document.getElementById('miniPlayerClose');
  if (!audio || !playBtn) return;

  // Wire the audio element to the global AudioStore. The controller will
  // also attach orchestration listeners (ended → autoplay, timeupdate →
  // recovery snapshot) via the element module.
  hookAudioToStore(audio);

  playBtn.innerHTML = icon('play', 18);
  if (closeBtn) closeBtn.innerHTML = icon('close', 14);

  // Play/pause button — delegate to the controller so the token-protected
  // playback layer handles race conditions.
  playBtn.addEventListener('click', (e: Event) => {
    e.stopPropagation();
    if (!audio) return;
    if (audio.paused) playerResume();
    else playerPause();
  });
  if (closeBtn) {
    closeBtn.addEventListener('click', (e: Event) => { e.stopPropagation(); hide(); });
  }
  if (coverBtn) {
    coverBtn.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      const od = w().openDetail;
      if (currentTrackId && typeof od === 'function') od('track', currentTrackId);
    });
  }
  el.addEventListener('click', () => {
    const od = w().openDetail;
    if (currentTrackId && typeof od === 'function') od('track', currentTrackId);
  });

  // VIEW listeners: icon swap + scrubber fill. Race-free because they only
  // mirror the element's events into the DOM.
  audio.addEventListener('play',  () => { if (playBtn) playBtn.innerHTML = icon('pause', 18); });
  audio.addEventListener('pause', () => { if (playBtn) playBtn.innerHTML = icon('play', 18); });
  audio.addEventListener('ended', () => {
    if (playBtn) playBtn.innerHTML = icon('play', 18);
    if (fill) fill.style.width = '0%';
  });
  audio.addEventListener('timeupdate', () => {
    if (!audio || !audio.duration) return;
    if (fill) fill.style.width = ((audio.currentTime / audio.duration) * 100).toFixed(2) + '%';
  });

  // Scrubber tap → controller seek (token-protected, race-safe).
  const scrubberWrap = el.querySelector<HTMLElement>('.mini-player-scrubber');
  if (scrubberWrap) {
    scrubberWrap.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      if (!audio || !audio.duration || isNaN(audio.duration)) return;
      const rect = scrubberWrap.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seekToRatio(ratio);
    });
  }

  initialized = true;
}

/**
 * Update the title/sub/cover/visibility WITHOUT touching audio.src or
 * triggering play. Called by the controller right before playUrl().
 */
function applyMetadata(track: MiniPlayerTrack, coverUrl: string | null): void {
  init();
  if (!el || !titleEl || !subEl || !coverBtn) return;
  currentTrackId = track.id;
  const statusFn = w().statusLabel;
  const statusText = typeof statusFn === 'function' ? statusFn(track.status) : '';
  const subtitle = [statusText, track.feat].filter(Boolean).join(' · ') || 'Noname';
  titleEl.textContent = track.name || 'Sans titre';
  subEl.textContent = subtitle;
  coverBtn.style.backgroundImage = coverUrl ? `url('${coverUrl}')` : 'none';
  el.hidden = false;
}

/** Update ONLY the cover backgroundImage (called when cover resolves late). */
function applyCover(url: string): void {
  if (coverBtn) coverBtn.style.backgroundImage = `url('${url}')`;
}

/**
 * LEGACY entry point — applyMetadata + playUrl. Used by inline callers
 * that haven't moved to controller.playTrack yet. Once TS-20 lands, this
 * becomes deprecated.
 */
function show(track: MiniPlayerTrack, audioUrl: string, coverUrl?: string): void {
  applyMetadata(track, coverUrl || null);
  playUrl(audioUrl);
}

function hide(): void {
  if (!el) return;
  playerStop(); // pauses + clears src + bumps the intent token
  el.hidden = true;
  currentTrackId = null;
}

export const MiniPlayer: MiniPlayerAPI = Object.freeze({
  init: init,
  show: show,
  applyMetadata: applyMetadata,
  applyCover: applyCover,
  hide: hide,
});

// Test hook (used by /src/main.ts to drive the controller's applyMetadata dep).
export function _getCurrentMiniPlayerTrackId(): string | null {
  return currentTrackId;
}
