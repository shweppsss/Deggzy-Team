// ============================================================================
// Auth foundation — hooks wiring. Phase TS-11.
//
// Composes the TS-only auth surface and registers it into pin.ts. Replaces
// the TS-10 main.ts shim that injected legacy `window.X` lookups for the
// crypto / enterApp / signOutUser hooks.
//
// After TS-11:
//   - `registerPinHooks({ verifyPin, hashPin, signOutUser, ... })` reads
//     the TS implementations directly (crypto.ts, auth-state.ts).
//   - The only hooks that still go through `window` are the UI primitives
//     (`enterApp`, `haptic`, `toast`, `updateDots`) that are concerns
//     outside the auth domain — those migrate alongside their own modules.
// ============================================================================

import { registerPinHooks } from './pin';
import { hashPin, verifyPin } from './crypto';
import { signOutUserOrchestrated } from './auth-state';

interface AuthHostHooks {
  /** Repaint the 4-dot PIN row. Inline (still in index.html). */
  updateDots?: () => void;
  /** Vibration. Inline. */
  haptic?: (ms: number) => void;
  /** App-wide toast. Inline. */
  toast?: (message: string) => void;
  /** Boot the app after a successful PIN. Inline. */
  enterApp?: () => void;
  /** Reset the WebAuthn auto-trigger counter on a successful PIN. Inline. */
  clearWebAuthnAutoTrigFails?: () => void;
}

/**
 * Wire all PIN hooks from TS sources, with UI-primitive hooks supplied by
 * the host (main.ts reads them off window). After TS-11 the crypto +
 * signOutUser hooks are static TS imports — no more window lookups for them.
 */
export function wireAuthHooks(host: AuthHostHooks): void {
  registerPinHooks({
    updateDots: host.updateDots,
    haptic: host.haptic,
    toast: host.toast,
    enterApp: host.enterApp,
    clearWebAuthnAutoTrigFails: host.clearWebAuthnAutoTrigFails,
    // TS-only sources — no more `window.verifyPin` / `window.hashPin` /
    // `window.signOutUser` lookups.
    verifyPin: verifyPin,
    hashPin: hashPin,
    signOutUser: () => { void signOutUserOrchestrated(); },
  });
}
