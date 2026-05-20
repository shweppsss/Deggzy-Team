// ============================================================================
// Deggzy-Team — TypeScript migration entry point
// ============================================================================
//
// This module is the single Vite entry point. It imports the typed core
// modules and re-exposes them on `window.App.X` so that the remaining
// inline code in index.html (and inline event handlers) keep seeing the
// same global names during the transition.
//
// Migration roadmap:
//   TS-0  ✓  tooling setup (empty entry point)
//   TS-1  ✓  App.Runtime → /src/core/runtime.ts
//   TS-2  ✓  App.Boot → /src/core/boot.ts
//   TS-3  ✓  App.Instrumentation → /src/core/instrumentation.ts
//   TS-4  ✓  render utilities → /src/lib/render-utils.ts
//   TS-5  ✓  MiniPlayer → /src/features/mini-player.ts
//   TS-6  ✓  detail overlay lifecycle → /src/features/detail/
//   TS-7  ✓  detail render helpers (per-kind, pure) → /src/features/detail/render/
//   TS-8  ← current PR: kill detail bridge → /src/lib/format-utils.ts + /src/features/detail/domain.ts
//   TS-9+    modals, auth, calendar
//   TS-final HTML decomposition
// ============================================================================

import { Runtime } from './core/runtime';
import { Boot } from './core/boot';
import { Instrumentation } from './core/instrumentation';
import {
  ICONS,
  icon,
  hydrateIcons,
  EMPTY_ART,
  emptyState,
  parseDate,
  isFutureOrToday,
} from './lib/render-utils';
import {
  escapeHtml,
  formatDate,
  formatDateLong,
  formatEventTime,
  formatDuration,
  formatEventRange,
  formatRelativeShort,
  timeToMins,
  minsToTime,
} from './lib/format-utils';
import { MiniPlayer } from './features/mini-player';
import { openDetail, closeDetail, bindDetailClose } from './features/detail';
import {
  typeLabel,
  statusLabel,
  todoPriority,
  tagsToInput,
  suggestChecklist,
  EVENT_TYPES,
  TODO_CATEGORIES,
  PRIORITY_KEYS,
  PRIORITY_LABELS,
} from './features/detail/domain';
import {
  actorInitial,
  actorColor,
  eventActorAvatarHTML,
} from './features/detail/event-actor';
import {
  openEventModal,
  closeEventModal,
  setEventVisibility,
  refreshRecurrenceUntilVisibility,
  getEditingEventId,
  setEditingEventId,
  openRoleModal,
  closeRoleModal,
  selectRole,
  getPendingRoleKey,
  openInspiLink,
  closeInspiModal,
  showInspiPreview,
  clearInspiDraft,
  handleInspiUrlChange,
  handleInspiModalFile,
  getInspiDraft,
} from './features/modals';
// TS-10 — auth foundation: local runtime (PIN + session + storage).
// Network (Supabase / signup / OAuth) stays inline for now.
import {
  // session
  getCurrentUser,
  setCurrentUser,
  getCurrentProfile,
  setCurrentProfile,
  isSignOutInProgress,
  setSignOutInProgress,
  logoutLocalState,
  // storage
  LOCAL_PIN_KEY_PREFIX,
  PIN_LOCKOUT_THRESHOLDS,
  isWeakPin,
  getPinLockState,
  recordPinFailure,
  clearPinFailures,
  // pin
  pinKeyPress,
  pinDelete,
  submitPinBuffer,
  resetPinBuffer,
  getPinBuffer,
  bindPinKeypad,
  pinKeyboardHandler,
  // TS-11 — network + orchestration
  hashPin,
  verifyPin,
  setSupabaseClient,
  signInWithPassword,
  signUpWithPassword,
  supabaseSignOut,
  getSession,
  signOutUserOrchestrated,
  signInUserOrchestrated,
  attachAuthStateListener,
  registerAuthLifecycleHooks,
  wireAuthHooks,
} from './features/auth';

// Augment the global Window type so the legacy code that references
// `window.App.X.*` and the bare-global helpers (icon, parseDate, etc.)
// compiles against the same surface as the runtime version exposes.
declare global {
  interface Window {
    App: {
      Runtime?: typeof Runtime;
      Boot?: typeof Boot;
      Instrumentation?: typeof Instrumentation;
      [key: string]: unknown;
    };
    // Bare globals — historically declared via `const X = ...` at module
    // scope inside the inline <script>. The legacy call sites reference
    // them without any namespace, so we must re-attach them on `window`
    // to keep those call sites working unchanged.
    ICONS: typeof ICONS;
    icon: typeof icon;
    hydrateIcons: typeof hydrateIcons;
    EMPTY_ART: typeof EMPTY_ART;
    emptyState: typeof emptyState;
    parseDate: typeof parseDate;
    isFutureOrToday: typeof isFutureOrToday;
    MiniPlayer: typeof MiniPlayer;
    openDetail: typeof openDetail;
    closeDetail: typeof closeDetail;
    bindDetailClose: typeof bindDetailClose;
    // TS-8 — format utilities
    escapeHtml: typeof escapeHtml;
    formatDate: typeof formatDate;
    formatDateLong: typeof formatDateLong;
    formatEventTime: typeof formatEventTime;
    _formatDuration: typeof formatDuration;
    _formatEventRange: typeof formatEventRange;
    _formatRelativeShort: typeof formatRelativeShort;
    _timeToMins: typeof timeToMins;
    _minsToTime: typeof minsToTime;
    // TS-8 — detail domain
    typeLabel: typeof typeLabel;
    statusLabel: typeof statusLabel;
    todoPriority: typeof todoPriority;
    tagsToInput: typeof tagsToInput;
    suggestChecklist: typeof suggestChecklist;
    EVENT_TYPES: typeof EVENT_TYPES;
    TODO_CATEGORIES: typeof TODO_CATEGORIES;
    PRIORITY_KEYS: typeof PRIORITY_KEYS;
    PRIORITY_LABELS: typeof PRIORITY_LABELS;
    // TS-8 — detail event-actor helpers
    _actorInitial: typeof actorInitial;
    _actorColor: typeof actorColor;
    _eventActorAvatarHTML: typeof eventActorAvatarHTML;
    // TS-9 — modals (event / role / inspi)
    openEventModal: typeof openEventModal;
    closeEventModal: typeof closeEventModal;
    _setEventVisibility: typeof setEventVisibility;
    _refreshRecurrenceUntilVisibility: typeof refreshRecurrenceUntilVisibility;
    openRoleModal: typeof openRoleModal;
    closeRoleModal: typeof closeRoleModal;
    _selectRole: typeof selectRole;
    openInspiLink: typeof openInspiLink;
    closeInspiModal: typeof closeInspiModal;
    showInspiPreview: typeof showInspiPreview;
    clearInspiDraft: typeof clearInspiDraft;
    handleInspiUrlChange: typeof handleInspiUrlChange;
    handleInspiModalFile: typeof handleInspiModalFile;
    // Mutable bindings the inline save flows read.
    editingEventId: string | null;
    _pendingRoleKey: string | null;
    _inspiDraft: ReturnType<typeof getInspiDraft>;
    // TS-10 — auth foundation
    _currentUser: ReturnType<typeof getCurrentUser>;
    _currentProfile: ReturnType<typeof getCurrentProfile>;
    _signOutInProgress: boolean;
    LOCAL_PIN_KEY_PREFIX: typeof LOCAL_PIN_KEY_PREFIX;
    PIN_LOCKOUT_THRESHOLDS: typeof PIN_LOCKOUT_THRESHOLDS;
    isWeakPin: typeof isWeakPin;
    getPinLockState: () => ReturnType<typeof getPinLockState>;
    recordPinFailure: () => ReturnType<typeof recordPinFailure>;
    clearPinFailures: () => void;
    pinKeyPress: typeof pinKeyPress;
    pinDelete: typeof pinDelete;
    submitPinBuffer: typeof submitPinBuffer;
    bindPinKeypad: typeof bindPinKeypad;
    logoutLocalState: typeof logoutLocalState;
    _pinBuffer: string;
    // TS-11 — auth network surface
    hashPin: typeof hashPin;
    verifyPin: typeof verifyPin;
    signInUserTS: (email: string, password: string) => Promise<{ ok: boolean; user: unknown; errorMessage?: string }>;
    signOutUserTS: () => Promise<void>;
    getSessionTS: typeof getSession;
    // Inline Supabase client — created by the inline initSupabase() call.
    sb: unknown;
  }
}

// Set up the global App namespace (idempotent — defensive against any
// inline code that might have already touched it).
window.App = window.App || {};

// Expose the typed core modules on window.App. This must happen BEFORE
// any code that uses `window.App.X.*` runs at user-interaction time.
// Module scripts are deferred by the HTML spec, so these assignments
// land before DOMContentLoaded fires.
window.App.Runtime = Runtime;
window.App.Boot = Boot;
window.App.Instrumentation = Instrumentation;

// Expose the bare-global render helpers. The legacy inline render
// functions in index.html call these without any namespace prefix
// (e.g. `icon('check', 14)`), so we re-attach them on `window` so
// the inline call sites keep working unchanged. This namespace
// pollution is acceptable as a migration step — future PRs that move
// the render functions themselves to TS modules will import from
// `./lib/render-utils` directly and we can drop these assignments.
window.ICONS = ICONS;
window.icon = icon;
window.hydrateIcons = hydrateIcons;
window.EMPTY_ART = EMPTY_ART;
window.emptyState = emptyState;
window.parseDate = parseDate;
window.isFutureOrToday = isFutureOrToday;

// MiniPlayer was historically `const MiniPlayer = (() => {...})()` at
// module scope inside the inline <script>, so it lives on `window` as a
// bare global. Inline call sites (`MiniPlayer.show(...)`) keep working
// unchanged after this assignment.
window.MiniPlayer = MiniPlayer;

// Detail overlay lifecycle — historically inline `function openDetail()`,
// `function closeDetail()`, `function bindDetailClose()` declared at
// module scope. Re-attached on `window` to keep the legacy inline call
// sites (`if (typeof openDetail === 'function') openDetail(kind, id);`)
// working unchanged. Future TS modules should import from
// `./features/detail` directly instead of going through window.
window.openDetail = openDetail;
window.closeDetail = closeDetail;
window.bindDetailClose = bindDetailClose;

// TS-8 — format utilities + detail domain constants/helpers. These were
// originally declared with `function X()` / `const X = ...` at module
// scope inside the inline <script>, so they live on `window` as bare
// globals. The legacy inline call sites use them without any namespace
// prefix (e.g. `escapeHtml(s)`, `EVENT_TYPES.map(...)`). The underscore-
// prefixed names match the original inline names exactly so legacy
// callers don't have to be touched.
window.escapeHtml = escapeHtml;
window.formatDate = formatDate;
window.formatDateLong = formatDateLong;
window.formatEventTime = formatEventTime;
window._formatDuration = formatDuration;
window._formatEventRange = formatEventRange;
window._formatRelativeShort = formatRelativeShort;
window._timeToMins = timeToMins;
window._minsToTime = minsToTime;
window.typeLabel = typeLabel;
window.statusLabel = statusLabel;
window.todoPriority = todoPriority;
window.tagsToInput = tagsToInput;
window.suggestChecklist = suggestChecklist;
window.EVENT_TYPES = EVENT_TYPES;
window.TODO_CATEGORIES = TODO_CATEGORIES;
window.PRIORITY_KEYS = PRIORITY_KEYS;
window.PRIORITY_LABELS = PRIORITY_LABELS;
// Event-actor helpers — historically inline `function _actorInitial()` /
// `function _actorColor()` / `function _eventActorAvatarHTML()` at module
// scope. Re-attached on window with their original underscore-prefixed
// names so the inline call sites in calendar/event rendering keep working.
window._actorInitial = actorInitial;
window._actorColor = actorColor;
window._eventActorAvatarHTML = eventActorAvatarHTML;

// TS-9 — modal lifecycle. The inline save flows (saveEvent / saveRole /
// saveInspiLink) and the global ESC + outside-click delegates in
// index.html call these by their bare names. We also bridge the 3
// mutable bindings (editingEventId, _pendingRoleKey, _inspiDraft)
// through accessor functions so the inline save flows can read the
// current value without our TS module losing single-source-of-truth.
window.openEventModal = openEventModal;
window.closeEventModal = closeEventModal;
window._setEventVisibility = setEventVisibility;
window._refreshRecurrenceUntilVisibility = refreshRecurrenceUntilVisibility;
window.openRoleModal = openRoleModal;
window.closeRoleModal = closeRoleModal;
window._selectRole = selectRole;
window.openInspiLink = openInspiLink;
window.closeInspiModal = closeInspiModal;
window.showInspiPreview = showInspiPreview;
window.clearInspiDraft = clearInspiDraft;
window.handleInspiUrlChange = handleInspiUrlChange;
window.handleInspiModalFile = handleInspiModalFile;
// Mirror the mutable bindings via getter/setter properties so the inline
// save flow can `editingEventId = null` and the TS module sees it.
Object.defineProperty(window, 'editingEventId', {
  configurable: true,
  enumerable: true,
  get: getEditingEventId,
  set: setEditingEventId,
});
Object.defineProperty(window, '_pendingRoleKey', {
  configurable: true,
  enumerable: true,
  get: getPendingRoleKey,
  set: () => {
    /* read-only from window; setting is a no-op intentionally — the
       inline saveRole only reads. If a future flow needs to clear it,
       call closeRoleModal() which does so. */
  },
});
Object.defineProperty(window, '_inspiDraft', {
  configurable: true,
  enumerable: true,
  get: getInspiDraft,
  set: () => {
    /* same as above — read-only window mirror. saveInspiLink only reads. */
  },
});

// ===========================================================================
// TS-10 — AUTH FOUNDATION (PIN + session + storage)
// ===========================================================================

// TS-11 — PIN hooks are now wired via `wireAuthHooks` (verifyPin / hashPin /
// signOutUser come from TS modules directly). Only the UI primitives
// (updateDots / haptic / toast / enterApp / clearWebAuthnAutoTrigFails)
// still cross into inline territory — they're concerns owned by other
// domains that will migrate separately.
wireAuthHooks({
  updateDots: () => {
    const w = window as unknown as { updatePinDots?: () => void };
    if (typeof w.updatePinDots === 'function') w.updatePinDots();
  },
  haptic: (ms) => {
    const w = window as unknown as { haptic?: (ms: number) => void };
    if (typeof w.haptic === 'function') w.haptic(ms);
  },
  toast: (msg) => {
    const w = window as unknown as { toast?: (m: string) => void };
    if (typeof w.toast === 'function') w.toast(msg);
  },
  enterApp: () => {
    const w = window as unknown as { enterApp?: () => void };
    if (typeof w.enterApp === 'function') w.enterApp();
  },
  clearWebAuthnAutoTrigFails: () => {
    const w = window as unknown as { _clearWebAuthnAutoTrigFails?: () => void };
    if (typeof w._clearWebAuthnAutoTrigFails === 'function') w._clearWebAuthnAutoTrigFails();
  },
});

// TS-11 — register the auth-state lifecycle hooks for the side-effects
// the orchestrator delegates back to inline (realtime tear-down, page
// reload, profile hydration, post-auth UI flow).
registerAuthLifecycleHooks({
  cleanupRealtimeChannels: () => {
    const w = window as unknown as {
      _realtimeChannel?: unknown;
      _activityChannel?: unknown;
      sb?: { removeChannel?: (ch: unknown) => void };
    };
    if (w._realtimeChannel && w.sb?.removeChannel) {
      try { w.sb.removeChannel(w._realtimeChannel); } catch (_e) { /* no-op */ }
      w._realtimeChannel = null;
    }
    if (w._activityChannel && w.sb?.removeChannel) {
      try { w.sb.removeChannel(w._activityChannel); } catch (_e) { /* no-op */ }
      w._activityChannel = null;
    }
  },
  reload: () => {
    try { location.reload(); } catch (_e) { /* no-op (test env) */ }
  },
  loadProfile: async () => {
    const w = window as unknown as { loadProfileFromCloud?: () => Promise<unknown> };
    if (typeof w.loadProfileFromCloud === 'function') {
      return (await w.loadProfileFromCloud()) as ReturnType<typeof getCurrentProfile>;
    }
    return null;
  },
  postAuthFlow: async () => {
    const w = window as unknown as { postAuthFlow?: () => Promise<void> | void };
    if (typeof w.postAuthFlow === 'function') await w.postAuthFlow();
  },
  showResetPassword: () => {
    const w = window as unknown as { showResetPassword?: () => void };
    if (typeof w.showResetPassword === 'function') w.showResetPassword();
  },
});

// TS-11 — when the inline Supabase client (`sb`) initializes, it sets
// `window.sb`. We poll briefly + then call setSupabaseClient(sb) and
// attach the auth-state listener. Done as a microtask so it lands AFTER
// the inline `initSupabase()` finishes its sync setup.
queueMicrotask(() => {
  const w = window as unknown as { sb?: unknown };
  if (w.sb) {
    setSupabaseClient(w.sb as Parameters<typeof setSupabaseClient>[0]);
    attachAuthStateListener();
  } else {
    // Late init — retry on next macrotask. The inline code creates `sb`
    // before any UI binding; this fallback handles cold-load timing.
    setTimeout(() => {
      const w2 = window as unknown as { sb?: unknown };
      if (w2.sb) {
        setSupabaseClient(w2.sb as Parameters<typeof setSupabaseClient>[0]);
        attachAuthStateListener();
      }
    }, 100);
  }
});

// Bare-global re-exposure of constants + helpers.
window.LOCAL_PIN_KEY_PREFIX = LOCAL_PIN_KEY_PREFIX;
window.PIN_LOCKOUT_THRESHOLDS = PIN_LOCKOUT_THRESHOLDS;
window.isWeakPin = isWeakPin;
window.pinKeyPress = pinKeyPress;
window.pinDelete = pinDelete;
window.submitPinBuffer = submitPinBuffer;
window.bindPinKeypad = bindPinKeypad;
window.logoutLocalState = logoutLocalState;

// PIN lockout API — the inline call sites use these as if they read the
// CURRENT user implicitly. We wrap them to inject the active user id.
window.getPinLockState = () => getPinLockState(getCurrentUser()?.id);
window.recordPinFailure = () => recordPinFailure(getCurrentUser()?.id);
window.clearPinFailures = () => clearPinFailures(getCurrentUser()?.id);

// Mutable session bindings — `_currentUser` / `_currentProfile` /
// `_signOutInProgress` are read AND written from inline (signIn handler
// sets them; everywhere reads them). Object.defineProperty with both
// getter and setter mirrors the inline `let` semantics; the TS module
// stays single source of truth.
Object.defineProperty(window, '_currentUser', {
  configurable: true,
  enumerable: true,
  get: getCurrentUser,
  set: (v) => setCurrentUser(v as ReturnType<typeof getCurrentUser>),
});
Object.defineProperty(window, '_currentProfile', {
  configurable: true,
  enumerable: true,
  get: getCurrentProfile,
  set: (v) => setCurrentProfile(v as ReturnType<typeof getCurrentProfile>),
});
Object.defineProperty(window, '_signOutInProgress', {
  configurable: true,
  enumerable: true,
  get: isSignOutInProgress,
  set: (v) => setSignOutInProgress(!!v),
});

// `_pinBuffer` is read by inline pinTryFaceId() to decide whether to
// auto-trigger the OS prompt. Read-only window mirror is enough.
Object.defineProperty(window, '_pinBuffer', {
  configurable: true,
  enumerable: true,
  get: getPinBuffer,
  set: () => { /* read-only */ },
});

// Physical-keyboard handler — attached at module-load time so it
// matches the inline-script behavior exactly. The `offsetParent === null`
// gate inside pinKeyboardHandler IS the historical bug-guard; see pin.ts
// header comment + SC39 in the harness.
document.addEventListener('keydown', pinKeyboardHandler);

// TS-11 — expose the typed crypto + orchestrators on window so legacy
// inline code (signInUser / handleResetPin / etc.) can call them by
// name. Existing inline `hashPin` / `verifyPin` declarations are removed
// from index.html below; these assignments are the replacement.
window.hashPin = hashPin;
window.verifyPin = verifyPin;
// Suffixed names so they don't collide with the inline `signInUser` /
// `signOutUser` that still own the email-lockout layer + UI loading state.
// Inline `signOutUser` now delegates to `window.signOutUserTS` at its end.
window.signInUserTS = (email, password) => signInUserOrchestrated(email, password);
window.signOutUserTS = () => signOutUserOrchestrated();
window.getSessionTS = getSession;
// Silence unused-import warnings for accessors we still import but call lazily.
void signUpWithPassword;
void supabaseSignOut;
