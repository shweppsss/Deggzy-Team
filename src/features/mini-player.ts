// ============================================================================
// MiniPlayer — pure addition, no audio-logic changes.
// Extracted to TypeScript in Phase TS-5.
//
// Encapsulated audio "now playing" pill UI. Reads track + audio URL + cover
// URL, drives a hidden <audio> element bound to the global AudioStore.
// Surfaces metadata to Media Session API (iOS lock screen, Control Center,
// CarPlay) when supported.
//
// PUBLIC SURFACE:
//   - init()                          → idempotent: wire DOM + audio events
//   - show(track, audioUrl, coverUrl) → show pill, set audio src, play
//   - hide()                          → pause, clear src, hide pill
//
// DEPENDENCIES:
//   - hookAudioToStore + setAudioState — imported directly from
//     /src/features/audio (TS-17, single source of truth)
//   - icon() — TS export from /src/lib/render-utils
//   - statusLabel(status), openDetail('track', id) — still bare globals,
//     read lazily via typeof checks (degrade silently if unavailable)
// ============================================================================

import { icon } from '../lib/render-utils';
import { hookAudioToStore, setAudioState } from './audio';

interface MiniPlayerTrack {
  id: string;
  name?: string;
  status?: string;
  feat?: string;
}

interface AudioStateUpdate {
  trackId: string | null;
  isPlaying?: boolean;
  currentTime?: number;
  duration?: number;
  loading?: boolean;
}

export interface MiniPlayerAPI {
  init: () => void;
  show: (track: MiniPlayerTrack, audioUrl: string, coverUrl?: string) => void;
  hide: () => void;
}

// Cast helpers — these globals live on `window` because they are still
// defined inline in index.html. Each accessor returns `null` if the global
// isn't yet attached (e.g. during the very early boot window).
type Win = Window & {
  statusLabel?: (status?: string) => string;
  openDetail?: (kind: string, id: string) => void;
};

function w(): Win {
  return window as unknown as Win;
}

// AudioStateUpdate is preserved for the existing call-site shape, but it is
// now satisfied by the imported `setAudioState` from /src/features/audio.
void ({} as AudioStateUpdate);

// Module-private state (matches the closure scope of the inline IIFE).
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

  // Wire the audio element to the global AudioStore. All pill UI
  // (catalogue, detail, mini-player) reflects state from the store rather
  // than each listener reaching into the DOM independently.
  hookAudioToStore(audio);

  playBtn.innerHTML = icon('play', 18);
  if (closeBtn) closeBtn.innerHTML = icon('close', 14);

  // Buttons inside the pill stop propagation so the surrounding "open
  // detail" tap area doesn't fire on a play/pause/close press.
  playBtn.addEventListener('click', (e: Event) => {
    e.stopPropagation();
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
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
  // Tapping anywhere else on the pill (title/sub area) opens the detail.
  // Same intent as Apple Music's "tap pill to expand to Now Playing".
  el.addEventListener('click', () => {
    const od = w().openDetail;
    if (currentTrackId && typeof od === 'function') od('track', currentTrackId);
  });
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

  // Tap the scrubber to seek. The hit area is the whole scrubber wrapper
  // so even a 4px-tall fill is comfortably reachable. We pause→seek→resume
  // to avoid the brief blip iOS gives if you reposition during active playback.
  const scrubberWrap = el.querySelector<HTMLElement>('.mini-player-scrubber');
  if (scrubberWrap) {
    scrubberWrap.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      if (!audio || !audio.duration || isNaN(audio.duration)) return;
      const rect = scrubberWrap.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const wasPlaying = !audio.paused;
      if (wasPlaying) audio.pause();
      try { audio.currentTime = ratio * audio.duration; } catch (_err) { /* no-op */ }
      if (wasPlaying) audio.play().catch(() => {});
    });
  }

  // Media Session API — surfaces title/artist/cover on the iOS lock
  // screen, Control Center, Apple Watch, and CarPlay. Hardware play/pause
  // keys from AirPods / Bluetooth headphones route to the same handlers
  // as the on-screen buttons. mediaSession is undefined on older Safari —
  // guarded for safety.
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play',  () => { if (audio) audio.play().catch(() => {}); });
      navigator.mediaSession.setActionHandler('pause', () => { if (audio) audio.pause(); });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        if (!audio) return;
        const skip = (details && details.seekOffset) || 10;
        try { audio.currentTime = Math.max(0, audio.currentTime - skip); } catch (_e) { /* no-op */ }
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        if (!audio) return;
        const skip = (details && details.seekOffset) || 10;
        try { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + skip); } catch (_e) { /* no-op */ }
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (!audio) return;
        if (details && typeof details.seekTime === 'number') {
          try { audio.currentTime = details.seekTime; } catch (_e) { /* no-op */ }
        }
      });
    } catch (_e) { /* no-op — browser without all action handlers */ }
  }

  initialized = true;
}

function show(track: MiniPlayerTrack, audioUrl: string, coverUrl?: string): void {
  init();
  if (!el || !track || !audio || !titleEl || !subEl || !coverBtn) return;
  const isNewTrack = currentTrackId !== track.id;
  currentTrackId = track.id;
  const title = track.name || 'Sans titre';
  const statusFn = w().statusLabel;
  const statusText = typeof statusFn === 'function' ? statusFn(track.status) : '';
  const subtitle = [statusText, track.feat].filter(Boolean).join(' · ') || 'Noname';
  titleEl.textContent = title;
  subEl.textContent = subtitle;
  coverBtn.style.backgroundImage = coverUrl ? `url('${coverUrl}')` : 'none';

  // Notify the store BEFORE swapping src so any pill in the DOM
  // transitions its "active" highlight instantly, and the previous active
  // pill resets to 0% / play-icon without waiting for the new audio events.
  if (isNewTrack) {
    setAudioState({ trackId: track.id, currentTime: 0, duration: 0, loading: true });
  }
  if (audio.src !== audioUrl) audio.src = audioUrl;
  el.hidden = false;

  // Surface metadata to the iOS lock screen / Control Center / Apple
  // Watch / CarPlay. The cover is a blob: URL inside our origin → it
  // works as an artwork source. Falls back to no artwork if no cover yet.
  if ('mediaSession' in navigator) {
    try {
      const artwork = coverUrl ? [
        { src: coverUrl, sizes: '96x96',   type: 'image/png' },
        { src: coverUrl, sizes: '192x192', type: 'image/png' },
        { src: coverUrl, sizes: '512x512', type: 'image/png' },
      ] : [];
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: 'Degzzy',
        album: subtitle,
        artwork,
      });
    } catch (_e) { /* MediaMetadata unsupported on older browsers */ }
  }
  audio.play().catch(() => { /* user gesture required on some browsers */ });
}

function hide(): void {
  if (!el || !audio) return;
  audio.pause();
  audio.src = '';
  el.hidden = true;
  currentTrackId = null;
  // Clear the store so every pill in the DOM reverts to inactive/0%.
  setAudioState({ trackId: null, isPlaying: false, currentTime: 0, duration: 0, loading: false });
}

export const MiniPlayer: MiniPlayerAPI = Object.freeze({
  init: init,
  show: show,
  hide: hide,
});
