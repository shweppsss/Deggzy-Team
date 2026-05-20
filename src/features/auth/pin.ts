// ============================================================================
// Auth foundation — PIN runtime. Phase TS-10.
//
// THE CRITICAL FILE in TS-10. Contains:
//   - pinKeyPress / pinDelete  → digit / backspace into the buffer
//   - submitPinBuffer          → lockout check + verify + record-or-clear
//   - bindPinKeypad            → wire the 10 digit buttons (idempotent)
//   - attachPinKeyboardHandler → physical-keyboard support
//   - registerPinKeypadRuntime / registerPinSubmitHooks → DI for inline parts
//
// HISTORICAL BUG GUARD (auth audit findings):
// The physical-keyboard handler MUST gate on `pinView.offsetParent === null`
// rather than `pinView.style.display === 'none'`. The auth wrapper hides
// the WHOLE auth screen via display:none on the parent — pinView's own
// inline style stays 'flex'. The previous (broken) gate let Backspace
// be intercepted globally in the app, breaking text editing in every
// input. SC39 below pins this invariant.
//
// SC22-24 of the harness already exercise the keyboard handler with both
// visible + hidden states. TS-10 keeps those green and adds SC39 (the
// dedicated hidden-PIN keyboard-isolation test).
// ============================================================================

import type { AuthUser } from './types';
import {
  getPinLockState,
  recordPinFailure,
  clearPinFailures,
  getStoredPinHash,
  PIN_LOCKOUT_THRESHOLDS,
} from './storage';
import { getCurrentUser } from './session';

// ---------------------------------------------------------------------------
// Module-private state — single source of truth for the in-flight PIN.
// ---------------------------------------------------------------------------

let _pinBuffer = '';
let _pinLocked = false;

export function getPinBuffer(): string {
  return _pinBuffer;
}

export function getPinLocked(): boolean {
  return _pinLocked;
}

/**
 * Reset the PIN buffer to empty and unlock. Idempotent. Called by
 * session.logoutLocalState() and by submitPinBuffer on success/failure.
 */
export function resetPinBuffer(): void {
  _pinBuffer = '';
  _pinLocked = false;
}

// ---------------------------------------------------------------------------
// Runtime injections — supplied by main.ts at boot. Keeps pin.ts decoupled
// from the inline `verifyPin`, `enterApp`, `signOutUser`, `haptic`, `toast`.
// ---------------------------------------------------------------------------

interface PinRuntimeHooks {
  /** Repaint the 4-dot row to reflect `_pinBuffer.length`. */
  updateDots?: () => void;
  /** Brief vibration on key press. Bridge to inline `haptic()`. */
  haptic?: (ms: number) => void;
  /** App-wide toast. Bridge to inline `toast()`. */
  toast?: (message: string) => void;
  /** Bridge to inline `verifyPin(pin, storedHash) → Promise<boolean>`. */
  verifyPin?: (pin: string, stored: string | null) => Promise<boolean>;
  /** Inline `hashPin(pin) → Promise<string>` — used for the legacy → v2 upgrade. */
  hashPin?: (pin: string) => Promise<string>;
  /** Inline `enterApp()` — boots the app after a successful PIN. */
  enterApp?: () => void;
  /** Inline `signOutUser()` — force re-auth after `SIGNOUT` threshold. */
  signOutUser?: () => void;
  /** Optional reset of the Face-ID auto-trigger counter on success. */
  clearWebAuthnAutoTrigFails?: () => void;
}

let _hooks: PinRuntimeHooks = {};

export function registerPinHooks(hooks: PinRuntimeHooks): void {
  _hooks = { ..._hooks, ...hooks };
}

// ---------------------------------------------------------------------------
// Buffer manipulation
// ---------------------------------------------------------------------------

export function pinKeyPress(digit: string | number): void {
  if (_pinLocked) return;
  if (_pinBuffer.length >= 4) return;
  _pinBuffer += String(digit);
  if (_hooks.updateDots) _hooks.updateDots();
  if (_hooks.haptic) _hooks.haptic(15);
  if (_pinBuffer.length === 4) {
    _pinLocked = true;
    const snapshot = _pinBuffer;
    setTimeout(() => {
      if (_pinBuffer === snapshot) {
        submitPinBuffer();
      } else {
        _pinLocked = false;
      }
    }, 130);
  }
}

export function pinDelete(): void {
  if (_pinLocked) return;
  if (!_pinBuffer.length) return;
  _pinBuffer = _pinBuffer.slice(0, -1);
  if (_hooks.updateDots) _hooks.updateDots();
  if (_hooks.haptic) _hooks.haptic(10);
}

// Alias matching the directive's `pinBackspace` name. Both call sites
// (inline keypad button + physical keyboard) keep using pinDelete.
export const pinBackspace = pinDelete;

// ---------------------------------------------------------------------------
// Verification flow — orchestrates lockout-check → verify → success/fail.
// Network terminators (enterApp / signOutUser) are injected via hooks.
// ---------------------------------------------------------------------------

export async function submitPinBuffer(): Promise<void> {
  const user: AuthUser | null = getCurrentUser();
  if (!user) {
    resetPinBuffer();
    if (_hooks.updateDots) _hooks.updateDots();
    return;
  }

  // Lockout guard — refuse before checking the hash at all.
  const lock = getPinLockState(user.id);
  if (lock.isLocked) {
    const mins = Math.floor(lock.remainingSec / 60);
    const secs = lock.remainingSec % 60;
    const dur = mins > 0 ? mins + 'min ' + secs + 's' : secs + 's';
    if (_hooks.toast) _hooks.toast("Trop d'essais. Réessaie dans " + dur + '.');
    if (_hooks.haptic) _hooks.haptic(60);
    resetPinBuffer();
    if (_hooks.updateDots) _hooks.updateDots();
    return;
  }

  const stored = getStoredPinHash(user.id);
  let ok = false;
  try {
    if (_hooks.verifyPin) ok = await _hooks.verifyPin(_pinBuffer, stored);
  } catch (e) {
    // verify failure (e.g. malformed stored hash) — treat as wrong PIN.
    // The catch keeps the lockout counter / UI flow consistent even if
    // crypto.subtle throws on this platform.
    console.error('verifyPin failed:', e);
  }

  if (ok) {
    // If the stored hash is the legacy djb2 format, upgrade it transparently
    // to PBKDF2-SHA256 on this successful entry. The user pays a one-time
    // ~50 ms cost and the next login is fully on the strong algo.
    if (stored && stored.startsWith('h_') && _hooks.hashPin) {
      try {
        const upgraded = await _hooks.hashPin(_pinBuffer);
        // Write through the same key prefix — the storage module owns it.
        try { localStorage.setItem('degzzy_local_pin_' + user.id, upgraded); } catch (_e) { /* no-op */ }
        console.log('[PIN] Hash upgraded from djb2 to PBKDF2-SHA256');
      } catch (e) {
        console.warn('[PIN] Hash upgrade failed (kept legacy):', e);
      }
    }
    clearPinFailures(user.id);
    if (_hooks.clearWebAuthnAutoTrigFails) _hooks.clearWebAuthnAutoTrigFails();
    try {
      if (_hooks.enterApp) _hooks.enterApp();
    } catch (e) {
      console.error('enterApp failed:', e);
      if (_hooks.toast) _hooks.toast('Erreur ouverture app.');
    } finally {
      resetPinBuffer();
      if (_hooks.updateDots) _hooks.updateDots();
    }
    return;
  }

  // Wrong PIN — record + decide lockout response (auth audit fix C escalation).
  const { count, lockedUntil } = recordPinFailure(user.id);
  const T = PIN_LOCKOUT_THRESHOLDS;
  if (count >= T.SIGNOUT) {
    if (_hooks.toast) _hooks.toast("Trop d'essais. Déconnexion forcée — reconnecte-toi par email/mot de passe.");
    if (_hooks.haptic) _hooks.haptic(60);
    setTimeout(() => { if (_hooks.signOutUser) _hooks.signOutUser(); }, 1500);
    return;
  }
  const remainingAttempts = T.SIGNOUT - count;
  if (lockedUntil > 0) {
    const secs = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 1000));
    const minsLabel = secs >= 60 ? Math.floor(secs / 60) + 'min ' + (secs % 60) + 's' : secs + 's';
    if (count >= T.W30MIN) {
      if (_hooks.toast) _hooks.toast('Code incorrect (' + count + '/' + T.SIGNOUT + '). Verrouillé ' + minsLabel + '. Encore ' + remainingAttempts + ' essai' + (remainingAttempts > 1 ? 's' : '') + ' avant déconnexion forcée.');
    } else {
      if (_hooks.toast) _hooks.toast('Code incorrect (' + count + '/' + T.SIGNOUT + '). Verrouillé ' + minsLabel + '.');
    }
  } else {
    if (_hooks.toast) _hooks.toast('Code incorrect (' + count + '/' + T.SIGNOUT + ').');
  }
  if (_hooks.haptic) _hooks.haptic(60);
  // Shake-the-dots animation reset happens in updateDots's CSS layer; the
  // inline version added a class then removed it 400ms later — kept inline
  // to avoid coupling pin.ts to DOM class names.
  setTimeout(() => {
    resetPinBuffer();
    if (_hooks.updateDots) _hooks.updateDots();
  }, 360);
}

// ---------------------------------------------------------------------------
// Physical keyboard handler — the historical-bug-guard.
//
// EXPORTED so the harness can attach it in isolation (SC22-24 + new SC39).
// The handler reads `pinView.offsetParent` — null when ANY ancestor has
// display:none, so it stays inert when the auth wrapper hides the screen.
//
// NEVER swallow Backspace globally — the keyboard handler must be the
// ONLY place that calls preventDefault on Backspace + Delete for the
// PIN view, and only when the PIN view is genuinely visible.
// ---------------------------------------------------------------------------

export function pinKeyboardHandler(e: KeyboardEvent): void {
  const pinView = document.getElementById('authPinEntryView');
  // The offsetParent gate IS the bug fix. Don't replace with style.display.
  if (!pinView || (pinView as HTMLElement).offsetParent === null) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (/^[0-9]$/.test(e.key)) {
    e.preventDefault();
    pinKeyPress(e.key);
    return;
  }
  if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault();
    pinDelete();
    return;
  }
}

// ---------------------------------------------------------------------------
// Keypad button binder — idempotent. Replaces the inline `bindPinKeypad`.
// ---------------------------------------------------------------------------

interface QsaAware {
  qsa: (selector: string) => Element[];
}

/**
 * Wire the 10 digit buttons (`data-pin-digit="0".."9"`). Idempotent via
 * `data-pin-bound`. Takes an optional `runtime` (Runtime.qsa) for
 * consistent DOM lookups; falls back to native querySelectorAll.
 */
export function bindPinKeypad(runtime?: QsaAware): void {
  const buttons: Element[] = runtime
    ? runtime.qsa('button[data-pin-digit]')
    : Array.from(document.querySelectorAll('button[data-pin-digit]'));
  buttons.forEach((btn) => {
    const el = btn as HTMLElement;
    if (el.dataset.pinBound === '1') return;
    const digit = el.dataset.pinDigit;
    if (!digit || !/^[0-9]$/.test(digit)) return;
    el.addEventListener('click', () => { pinKeyPress(digit); });
    el.dataset.pinBound = '1';
  });
}
