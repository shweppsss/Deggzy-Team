// ============================================================================
// MediaSession API wiring — lockscreen / Control Center / hardware controls.
// Phase TS-19.
//
// `mediaSession` is undefined on older Safari; every call goes through a
// guarded helper. The controller is the only caller — it pipes play/pause/
// next/previous through us, and we sync metadata + setActionHandler.
// ============================================================================

let _initialized = false;

interface ActionHandlers {
  play: () => void;
  pause: () => void;
  seekBackward: (seconds: number) => void;
  seekForward: (seconds: number) => void;
  seekTo: (seconds: number) => void;
  nextTrack?: () => void;
  previousTrack?: () => void;
}

type NavWithMS = Navigator & {
  mediaSession?: {
    metadata: MediaMetadata | null;
    setActionHandler: (action: string, handler: ((details?: { seekOffset?: number; seekTime?: number }) => void) | null) => void;
  };
};

function getNav(): NavWithMS | null {
  if (typeof navigator === 'undefined') return null;
  return navigator as NavWithMS;
}

function isSupported(): boolean {
  const n = getNav();
  return !!(n && n.mediaSession && typeof n.mediaSession.setActionHandler === 'function');
}

/** Install action handlers on `navigator.mediaSession`. Idempotent. */
export function installActionHandlers(handlers: ActionHandlers): void {
  if (_initialized) return;
  if (!isSupported()) return;
  const ms = getNav()!.mediaSession!;
  try {
    ms.setActionHandler('play', () => handlers.play());
    ms.setActionHandler('pause', () => handlers.pause());
    ms.setActionHandler('seekbackward', (details) => {
      const offset = (details && details.seekOffset) || 10;
      handlers.seekBackward(offset);
    });
    ms.setActionHandler('seekforward', (details) => {
      const offset = (details && details.seekOffset) || 10;
      handlers.seekForward(offset);
    });
    ms.setActionHandler('seekto', (details) => {
      if (details && typeof details.seekTime === 'number') handlers.seekTo(details.seekTime);
    });
    if (handlers.nextTrack) {
      ms.setActionHandler('nexttrack', () => handlers.nextTrack && handlers.nextTrack());
    }
    if (handlers.previousTrack) {
      ms.setActionHandler('previoustrack', () => handlers.previousTrack && handlers.previousTrack());
    }
  } catch {
    // Older browsers throw on unrecognised action names — best-effort install.
  }
  _initialized = true;
}

/** Update the now-playing metadata. Pass coverUrl='' to clear artwork. */
export function setMetadata(title: string, subtitle: string, coverUrl: string | null): void {
  if (!isSupported()) return;
  const ms = getNav()!.mediaSession!;
  const MM = (typeof MediaMetadata !== 'undefined') ? MediaMetadata : null;
  if (!MM) return;
  try {
    const artwork = coverUrl ? [
      { src: coverUrl, sizes: '96x96', type: 'image/png' },
      { src: coverUrl, sizes: '192x192', type: 'image/png' },
      { src: coverUrl, sizes: '512x512', type: 'image/png' },
    ] : [];
    ms.metadata = new MM({
      title,
      artist: 'Degzzy',
      album: subtitle,
      artwork,
    });
  } catch {
    // MediaMetadata throws on older Safari without the API.
  }
}

/** Test hook. */
export function _isInitialized(): boolean { return _initialized; }
export function _resetMediaSession(): void { _initialized = false; }
