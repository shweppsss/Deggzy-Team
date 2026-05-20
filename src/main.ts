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
// TS-12 — data layer + render dispatch.
import {
  // data
  setSupabaseDataClient,
  setSupabaseProfilesClient,
  setWorkspaceDefaults,
  getState as getWorkspaceState,
  setState as setWorkspaceState,
  hydrateStateFromLocal,
  patchState,
  loadWorkspace,
  saveWorkspace,
  registerCloudPushHook,
  loadProfile,
  ensureProfileExists,
  saveAlias,
  deepMergeWorkspace,
  mergeWorkspaceStates,
  loadStateFromLocal,
  type WorkspaceState,
} from './data';
import {
  // render
  registerSectionRenderer,
  registerPostRouteHook,
  registerRenderFailureHook,
  renderRoute,
  renderAll,
  invalidateSection,
  scheduleRender,
  getDirtySectionsForStateKeys,
  DASHBOARD_SECTION,
  TODOS_SECTION,
  CALENDAR_SECTION,
  INSPIRATIONS_SECTION,
  TEAM_SECTION,
  type SectionId,
} from './render';
// TS-13C — calendar render module.
import {
  renderCalendarView,
  registerCalendarInteractionHooks,
  expandEventsForWindow,
  detectEventConflicts,
  eventsOverlap as calEventsOverlap,
  OVERLOAD_THRESHOLD,
  type CalendarDeps,
} from './render/calendar';
import {
  toIsoDate,
  parseIsoDate,
  getMondayOf,
  addDays,
  diffDays,
  isoMin,
  isoMax,
} from './render/shared/dates';
// TS-14A — dashboard render module.
import {
  renderDashboardView,
  registerDashboardSideEffects,
  registerDashboardModelBuilder,
  type DashboardDeps as _DashboardDeps,
  type DashboardEvent,
  type DashboardProfile,
  type DashboardRole,
  type DashboardUser,
  type DashboardPhase,
  type DashboardModelInputs,
  type DashboardModelExtras,
} from './render/dashboard';
// (isFutureOrToday + parseDate already imported above from render-utils.)
// TS-14B — todos + inspirations render modules.
import {
  renderTodosView,
  registerTodosSideEffects,
  type TodoDeps as _TodoDeps,
} from './render/todos';
import {
  renderInspirationsView,
  registerInspirationsSideEffects,
  type InspiDeps as _InspiDeps,
} from './render/inspirations';
import { TODO_CATEGORIES as _TODO_CATS } from './features/detail/domain';
// TS-14C — assets + clips/capsules render modules.
import { renderAssetsView } from './render/assets';
import {
  renderVideoSectionView,
  registerVideoSectionSideEffects,
  type VideoDeps as _VideoDeps,
} from './render/clips';
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
    // TS-12 — data + render dispatch surface
    loadWorkspaceFromCloud: () => Promise<boolean>;
    pushWorkspaceToCloudTS?: () => void;
    loadProfileFromCloud: () => Promise<unknown>;
    ensureProfileExists: (name: string, role: string) => Promise<unknown>;
    saveAliasToCloud: (alias: string) => Promise<boolean>;
    renderView: typeof renderRoute;
    renderAll: typeof renderAll;
    requestRender: (opts?: { only?: SectionId[] }) => void;
    invalidateSection: typeof invalidateSection;
    state: WorkspaceState;
    save: () => void;
    // DEFAULTS lives inline (large), but main.ts forwards a reference to data/.
    DEFAULTS?: unknown;
    // TS-12 — legacy merge helpers exposed for inline callers.
    deepMerge: typeof deepMergeWorkspace;
    mergeWorkspaceStates: typeof mergeWorkspaceStates;
    loadState: () => WorkspaceState;
    saveImmediate?: () => void;
    // TS-13C — calendar render module + shared dates re-exposed for inline.
    renderCalendar: () => void;
    _isoDate: typeof toIsoDate;
    _parseIso: typeof parseIsoDate;
    _getMondayOf: typeof getMondayOf;
    _addDays: typeof addDays;
    _diffDays: typeof diffDays;
    _isoMin: typeof isoMin;
    _isoMax: typeof isoMax;
    _eventsOverlap: typeof calEventsOverlap;
    detectEventConflicts: typeof detectEventConflicts;
    expandEventsForWindow: typeof expandEventsForWindow;
    OVERLOAD_THRESHOLD: typeof OVERLOAD_THRESHOLD;
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

// ===========================================================================
// TS-12 — DATA LAYER + RENDER DISPATCH
// ===========================================================================

// ---- DATA: forward the inline DEFAULTS object reference + state binding ---
// The inline code declares `let state = loadState()` and `const DEFAULTS = {...}`
// at module scope. We mirror BOTH through window getter/setter properties
// so the TS data layer and the legacy inline code share the SAME object.
//
// Order of operations at boot:
//   1. Inline declares DEFAULTS + initial state (before this module runs).
//   2. This module reads `window.DEFAULTS` + `window.state` lazily on first
//      use, hands them to the data layer via setWorkspaceDefaults / setState.
//   3. From then on, every `state` read in inline goes through window.state,
//      which is now a getter that returns the TS data layer's snapshot.
//
// Because the inline code STILL declares `let state` at line ~10452, the
// window mirror cannot be installed before that line runs (the inline
// `let` shadows our getter). We resolve this by having the inline `let
// state = ...` line replaced by a window.defineProperty mirror further
// down in the index.html edits.
//
// For now we expose the wiring functions; the actual state mirror is set
// up when window.DEFAULTS becomes available.

queueMicrotask(() => {
  const w = window as unknown as { DEFAULTS?: WorkspaceState; state?: WorkspaceState; sb?: unknown };
  if (w.DEFAULTS) {
    setWorkspaceDefaults(w.DEFAULTS);
  }
  if (w.state) {
    setWorkspaceState(w.state);
  } else {
    // Cold load — hydrate from local storage using DEFAULTS as the base.
    if (w.DEFAULTS) setWorkspaceState(hydrateStateFromLocal());
  }
  // Mirror the data client to the auth client (same Supabase instance).
  if (w.sb) {
    setSupabaseDataClient(w.sb as Parameters<typeof setSupabaseDataClient>[0]);
    setSupabaseProfilesClient(w.sb as Parameters<typeof setSupabaseProfilesClient>[0]);
  }
});

// Cloud push hook — wired so the debounced `save()` in workspace.ts can
// trigger the inline `pushWorkspaceToCloud` without importing it. The
// inline cloud-push logic (retry, conflict-reconcile, session refresh)
// stays inline for TS-13+.
registerCloudPushHook(() => {
  const w = window as unknown as { pushWorkspaceToCloud?: () => void };
  if (typeof w.pushWorkspaceToCloud === 'function') {
    try { w.pushWorkspaceToCloud(); } catch (_e) { /* swallow — never let cloud push throw */ }
  }
});

// Window mirrors — legacy inline still uses these names.
window.loadWorkspaceFromCloud = loadWorkspace;
window.deepMerge = deepMergeWorkspace as typeof window.deepMerge;
window.mergeWorkspaceStates = mergeWorkspaceStates;
window.loadState = () => {
  const w = window as unknown as { DEFAULTS?: WorkspaceState };
  return loadStateFromLocal(w.DEFAULTS || {} as WorkspaceState);
};
// Profile data flows through the data layer now; auth lifecycle hook
// (registerAuthLifecycleHooks.loadProfile) is rewired to read it too.
window.loadProfileFromCloud = async () => {
  const u = getCurrentUser();
  if (!u) return null;
  const row = await loadProfile(u.id);
  if (row) setCurrentProfile(row);
  return row;
};
window.ensureProfileExists = async (name: string, role: string) => {
  const u = getCurrentUser();
  if (!u) return null;
  const row = await ensureProfileExists(u.id, u.email, name, role);
  if (row) setCurrentProfile(row);
  return row;
};
window.saveAliasToCloud = async (alias: string) => {
  const u = getCurrentUser();
  if (!u) return false;
  const ok = await saveAlias(u.id, alias);
  if (ok) {
    const cp = getCurrentProfile();
    if (cp) setCurrentProfile({ ...cp, alias: (alias || '').trim() || null });
  }
  return ok;
};

// Re-route the auth lifecycle hook (was reading window.loadProfileFromCloud
// LAZILY which was the inline impl). Now the inline impl IS our TS data
// layer wrapper — so the previous registration already works, no change.

// ---- RENDER DISPATCH -----------------------------------------------------
// Register each section's renderer against the inline impl. Inline still
// owns the DOM-rendering bodies; main.ts is the binding layer.
function callInlineRender(name: string): () => void {
  return () => {
    const w = window as unknown as Record<string, unknown>;
    const fn = w[name];
    if (typeof fn === 'function') (fn as () => void)();
  };
}

// TS-14A — dashboard now uses the TS render pipeline. main.ts builds
// the DashboardDeps snapshot lazily on each render by reading from
// TS modules (format-utils, render-utils, domain) + injecting the
// legacy helpers (filterVisibleEvents, isTodoOnDashboard) that haven't
// been migrated yet. No new window.X bridges added per directive.
function _buildDashboardDeps(): _DashboardDeps {
  type LegacyHelpers = {
    filterVisibleEvents?: (events: DashboardEvent[]) => DashboardEvent[];
    isTodoOnDashboard?: (todo: unknown, roleKey: string) => boolean;
  };
  const w = window as unknown as LegacyHelpers;
  const deps: _DashboardDeps = {
    filterVisibleEvents: (events: DashboardEvent[]) =>
      typeof w.filterVisibleEvents === 'function' ? w.filterVisibleEvents(events) : events,
    isTodoOnDashboard: (todo: unknown, roleKey: string) =>
      typeof w.isTodoOnDashboard === 'function' ? !!w.isTodoOnDashboard(todo, roleKey) : true,
    todoPriority: (todo: { priority?: unknown; urgent?: unknown }) => todoPriority(todo),
    formatDate: (s: string | undefined) => formatDate(s),
    formatEventTime: (s: string | undefined) => formatEventTime(s),
    typeLabel: (t: string | undefined) => typeLabel(t),
    escapeHtml: (s: string | null | undefined) => escapeHtml(s),
    icon: (name: string, size?: number, extra?: string) => icon(name, size, extra),
    emptyState: (kind: string, title: string, hint?: string, ctaLabel?: string, ctaOnclick?: string) =>
      emptyState(kind, title, hint, ctaLabel, ctaOnclick),
    isFutureOrToday: (s: string | undefined, now?: Date) => isFutureOrToday(s, now),
    parseDate: (s: string | undefined) => parseDate(s),
  };
  return deps;
}

// Side-effects hook — animateCounter / swipe / role widgets / saveAlias /
// toast / openDetail. The TS render orchestration calls these post-mount.
registerDashboardSideEffects({
  renderRoleWidgets: () => {
    const w = window as unknown as { renderRoleWidgets?: () => void };
    if (typeof w.renderRoleWidgets === 'function') w.renderRoleWidgets();
  },
  renderTeamActivity: async () => {
    const w = window as unknown as { renderTeamActivity?: () => Promise<void> };
    if (typeof w.renderTeamActivity === 'function') {
      try { await w.renderTeamActivity(); } catch (_e) { /* no-op */ }
    }
  },
  animateCounter: (el: HTMLElement, target: number) => {
    const w = window as unknown as { animateCounter?: (el: HTMLElement, target: number) => void };
    if (typeof w.animateCounter === 'function') w.animateCounter(el, target);
  },
  attachSwipeDelete: (el: HTMLElement, onDelete: () => void) => {
    const w = window as unknown as { attachSwipeDelete?: (el: HTMLElement, fn: () => void) => void };
    if (typeof w.attachSwipeDelete === 'function') w.attachSwipeDelete(el, onDelete);
  },
  swipeDeleteEvent: (id: string) => {
    const w = window as unknown as { swipeDeleteEvent?: (id: string) => void };
    if (typeof w.swipeDeleteEvent === 'function') w.swipeDeleteEvent(id);
  },
  saveAlias: async (alias: string) => {
    const u = getCurrentUser();
    if (!u) return false;
    return saveAlias(u.id, alias);
  },
  toast: (msg: string) => {
    const w = window as unknown as { toast?: (m: string) => void };
    if (typeof w.toast === 'function') w.toast(msg);
  },
  openDetail: (kind: string, id: string | number) => {
    openDetail(kind as Parameters<typeof openDetail>[0], String(id));
  },
});

// Reads inputs.events / inputs.todos from getState() inside mount.ts —
// but we also need to fill profile + user. Override the model builder
// to inject those from the TS auth session.
registerDashboardModelBuilder((inputs: DashboardModelInputs): DashboardModelExtras => {
  type Legacy = {
    PROJECT_DATE?: Date | string | number;
    PHASES?: DashboardPhase[];
    ROLE_BY_KEY?: Record<string, DashboardRole>;
    computePhase?: (today: Date) => DashboardPhase;
    getCurrentRoleKey?: () => string;
  };
  const w = window as unknown as Legacy;
  const projectDate = w.PROJECT_DATE instanceof Date
    ? w.PROJECT_DATE
    : (typeof w.PROJECT_DATE === 'string' || typeof w.PROJECT_DATE === 'number'
        ? new Date(w.PROJECT_DATE)
        : new Date('2026-09-11'));
  const phases: DashboardPhase[] = Array.isArray(w.PHASES) ? w.PHASES : [];
  const roleKey = typeof w.getCurrentRoleKey === 'function' ? w.getCurrentRoleKey() : 'autre';
  const role: DashboardRole = (w.ROLE_BY_KEY && w.ROLE_BY_KEY[roleKey])
    || (w.ROLE_BY_KEY && w.ROLE_BY_KEY['autre'])
    || { key: roleKey, label: 'Autre' };
  const phase = typeof w.computePhase === 'function'
    ? w.computePhase(inputs.today)
    : { label: '', title: '' };
  const phaseIdx = phases.findIndex((p) => p && p.label && phase.label && p.label.includes(phase.label));
  // Inject the TS-resolved profile + user into the inputs (mount.ts
  // passes inputs through with these merged in).
  inputs.profile = (getCurrentProfile() || null) as DashboardProfile | null;
  inputs.user = (getCurrentUser() || null) as DashboardUser | null;
  return { projectDate, phases, roleKey, role, phase, phaseIdx };
});

// TS-14A — register the dashboard renderer against the dispatch.
registerSectionRenderer(DASHBOARD_SECTION, () => {
  renderDashboardView(_buildDashboardDeps());
});
// The inline `function renderDashboard()` shim looks for `window.renderDashboardTS`
// — wire it here so legacy direct calls (e.g. `renderDashboard()` inside save flows)
// route through the TS pipeline.
(window as unknown as { renderDashboardTS?: () => void }).renderDashboardTS = () => {
  renderDashboardView(_buildDashboardDeps());
};
// TS-14B — todos + inspirations TS shims for the inline `renderTodos()` /
// `renderInspirations()` wrappers (which forward to these). Same pattern.
(window as unknown as { renderTodosTS?: () => void }).renderTodosTS = () => {
  renderTodosView(_buildTodoDeps());
};
(window as unknown as { renderInspirationsTS?: () => void }).renderInspirationsTS = () => {
  renderInspirationsView(_buildInspiDeps());
};
// TS-14C — assets + clips/capsules shims.
(window as unknown as { renderAssetsTS?: () => void }).renderAssetsTS = () => renderAssetsView();
(window as unknown as { renderClipsTS?: () => void }).renderClipsTS = () => renderVideoSectionView('clips', _buildVideoDeps());
(window as unknown as { renderCapsulesTS?: () => void }).renderCapsulesTS = () => renderVideoSectionView('capsules', _buildVideoDeps());
registerSectionRenderer('profile',             callInlineRender('renderProfile'));
// TS-14B — todos use the TS render pipeline.
function _buildTodoDeps(): _TodoDeps {
  type LegacyHelpers = {
    tagChipsHTML?: (tags: unknown, opts?: { limit?: number }) => string;
    _entityMatchesTagFilter?: (e: unknown) => boolean;
  };
  const w = window as unknown as LegacyHelpers;
  return {
    escapeHtml: (s: string | null | undefined) => escapeHtml(s),
    formatDate: (s: string | undefined) => formatDate(s),
    icon: (name: string, size?: number, extra?: string) => icon(name, size, extra),
    emptyState: (kind: string, title: string, hint?: string, ctaLabel?: string, ctaOnclick?: string) =>
      emptyState(kind, title, hint, ctaLabel, ctaOnclick),
    todoPriority: (t) => todoPriority(t),
    tagChipsHTML: (tags, opts) =>
      typeof w.tagChipsHTML === 'function' ? w.tagChipsHTML(tags, opts) : '',
    entityMatchesTagFilter: (t) =>
      typeof w._entityMatchesTagFilter === 'function' ? !!w._entityMatchesTagFilter(t) : true,
    categories: _TODO_CATS,
  };
}
registerTodosSideEffects({
  attachSwipeDelete: (el: HTMLElement, onDelete: () => void) => {
    const w = window as unknown as { attachSwipeDelete?: (el: HTMLElement, fn: () => void) => void };
    if (typeof w.attachSwipeDelete === 'function') w.attachSwipeDelete(el, onDelete);
  },
  swipeDeleteTodo: (id: string) => {
    const w = window as unknown as { swipeDeleteTodo?: (id: string) => void };
    if (typeof w.swipeDeleteTodo === 'function') w.swipeDeleteTodo(id);
  },
});
registerSectionRenderer(TODOS_SECTION, () => {
  renderTodosView(_buildTodoDeps());
});
registerSectionRenderer('catalogue',           callInlineRender('renderCatalogue'));
// TS-13C — calendar uses the TS render path. main.ts builds the
// CalendarDeps snapshot lazily on each render by reading the legacy
// inline helpers off window.
function _buildCalendarDeps(): CalendarDeps {
  type LegacyHelpers = {
    _eventTooltip?: (e: unknown) => string;
    tagChipsHTML?: (tags: unknown, opts?: { limit?: number }) => string;
    _entityMatchesTagFilter?: (e: unknown) => boolean;
    filterVisibleEvents?: (events: unknown[]) => unknown[];
    _eventActorAvatarHTML?: (actor: unknown, extraClass?: string) => string;
  };
  const w = window as unknown as LegacyHelpers;
  const deps: CalendarDeps = {
    eventTooltip: (e: unknown) => (typeof w._eventTooltip === 'function' ? w._eventTooltip(e) : ''),
    tagChipsHTML: (tags: unknown, opts?: { limit?: number }) => (typeof w.tagChipsHTML === 'function' ? w.tagChipsHTML(tags, opts) : ''),
    entityMatchesTagFilter: (e: unknown) => (typeof w._entityMatchesTagFilter === 'function' ? !!w._entityMatchesTagFilter(e) : true),
    filterVisibleEvents: ((events: unknown[]) => (typeof w.filterVisibleEvents === 'function' ? w.filterVisibleEvents(events) : events)) as CalendarDeps['filterVisibleEvents'],
    eventActorAvatarHTML: (actor: unknown) => (typeof w._eventActorAvatarHTML === 'function' ? w._eventActorAvatarHTML(actor) : ''),
  };
  return deps;
}
registerSectionRenderer(CALENDAR_SECTION, () => {
  renderCalendarView(_buildCalendarDeps());
});

// Register the inline drag-handler attach functions as the calendar's
// interaction hooks. The TS render module calls these after each render
// pass so the freshly-mounted pills become draggable again.
registerCalendarInteractionHooks({
  attachWeekInteractions: () => {
    const w = window as unknown as { attachWeekInteractions?: () => void };
    if (typeof w.attachWeekInteractions === 'function') w.attachWeekInteractions();
  },
  attachMonthInteractions: () => {
    const w = window as unknown as { attachCalendarInteractions?: () => void };
    if (typeof w.attachCalendarInteractions === 'function') w.attachCalendarInteractions();
  },
  upgradeEventAvatars: async () => {
    const w = window as unknown as { upgradeEventAvatars?: () => Promise<void> };
    if (typeof w.upgradeEventAvatars === 'function') {
      try { await w.upgradeEventAvatars(); } catch (_e) { /* no-op */ }
    }
  },
  renderTagsBar: () => {
    const w = window as unknown as { renderTagsBar?: () => void };
    if (typeof w.renderTagsBar === 'function') w.renderTagsBar();
  },
});
// TS-14B — inspirations use the TS render pipeline.
function _buildInspiDeps(): _InspiDeps {
  type LegacyHelpers = {
    parseMedia?: (url: string) => { mediaType?: string; mediaUrl?: string; mediaEmbed?: string; provider?: string } | null;
    INSPI_CATEGORIES?: ReadonlyArray<string>;
  };
  const w = window as unknown as LegacyHelpers;
  const cats: ReadonlyArray<string> = Array.isArray(w.INSPI_CATEGORIES)
    ? w.INSPI_CATEGORIES
    : ['Audio', 'Visuel', 'TikTok', 'Mood', 'Clip', 'Cover', 'Style', 'Autre'];
  return {
    escapeHtml: (s: string | null | undefined) => escapeHtml(s),
    icon: (name: string, size?: number, extra?: string) => icon(name, size, extra),
    emptyState: (kind: string, title: string, hint?: string, ctaLabel?: string, ctaOnclick?: string) =>
      emptyState(kind, title, hint, ctaLabel, ctaOnclick),
    parseMedia: (url: string) =>
      typeof w.parseMedia === 'function' ? w.parseMedia(url) : null,
    categories: cats,
  };
}
registerInspirationsSideEffects({
  getInspiUrl: async (id: string) => {
    const w = window as unknown as { getInspiUrl?: (id: string) => Promise<string | null | undefined> };
    if (typeof w.getInspiUrl !== 'function') return null;
    return w.getInspiUrl(id);
  },
});
registerSectionRenderer(INSPIRATIONS_SECTION, () => {
  renderInspirationsView(_buildInspiDeps());
});
// TS-14C — clips + capsules share the same TS render path.
function _buildVideoDeps(): _VideoDeps {
  return {
    escapeHtml: (s: string | null | undefined) => escapeHtml(s),
    icon: (name: string, size?: number, extra?: string) => icon(name, size, extra),
    emptyState: (kind: string, title: string, hint?: string, ctaLabel?: string, ctaOnclick?: string) =>
      emptyState(kind, title, hint, ctaLabel, ctaOnclick),
  };
}
registerVideoSectionSideEffects({
  hydrateVideoSection: async (kind) => {
    const w = window as unknown as { hydrateVideoSection?: (k: string) => Promise<void> | void };
    if (typeof w.hydrateVideoSection === 'function') {
      try { await w.hydrateVideoSection(kind); } catch (_e) { /* no-op */ }
    }
  },
});
registerSectionRenderer('clips',    () => { renderVideoSectionView('clips',    _buildVideoDeps()); });
registerSectionRenderer('capsules', () => { renderVideoSectionView('capsules', _buildVideoDeps()); });
// TS-14C — assets use the TS render path.
registerSectionRenderer('assets',   () => { renderAssetsView(); });
registerSectionRenderer(TEAM_SECTION,          callInlineRender('renderTeam'));
registerSectionRenderer('budget',              callInlineRender('renderBudget'));
registerSectionRenderer('plan',                callInlineRender('renderPlan'));
registerSectionRenderer('kpi',                 callInlineRender('renderKPI'));

// Profile's special-case post-render hook (`setupProfileAliasEdit`).
registerPostRouteHook('profile', () => {
  const w = window as unknown as { setupProfileAliasEdit?: () => void };
  if (typeof w.setupProfileAliasEdit === 'function') w.setupProfileAliasEdit();
});

// Sentry hook for render-failure capture (kept inline for now).
registerRenderFailureHook((section, error) => {
  const w = window as unknown as { captureSentryException?: (e: unknown, ctx: Record<string, unknown>) => void };
  if (typeof w.captureSentryException === 'function') {
    w.captureSentryException(error, { renderSection: section });
  }
});

// Replace the inline `renderView` / `renderAll` / `requestRender` with
// the TS dispatch layer. Legacy callers (`renderView('dashboard')`,
// `renderAll()`, `requestRender({ only: [...] })`) keep working.
window.renderView = renderRoute;
window.renderAll = renderAll;
window.requestRender = scheduleRender;
window.invalidateSection = invalidateSection;

// Save hook — main.ts forwards the TS debounced save through window.save.
// The inline code calls save() everywhere; we route those through the
// TS data layer (which still calls the inline `pushWorkspaceToCloud` via
// the registered cloud-push hook).
window.save = () => saveWorkspace();
// Immediate (non-debounced) flush — used by beforeunload, visibilitychange,
// logoutStudio, and anywhere a sync persist is required.
(window as unknown as { saveImmediate?: () => void }).saveImmediate = () => saveWorkspace({ immediate: true });

// TS-13C — calendar render entry point + shared dates re-exposed on
// window. The inline `renderCalendar()` (still in index.html, thin
// shim) delegates to `window.renderCalendar` which is now the TS view.
window.renderCalendar = () => {
  renderCalendarView(_buildCalendarDeps());
};
window._isoDate = toIsoDate;
window._parseIso = parseIsoDate;
window._getMondayOf = getMondayOf;
window._addDays = addDays;
window._diffDays = diffDays;
window._isoMin = isoMin;
window._isoMax = isoMax;
window._eventsOverlap = calEventsOverlap;
window.detectEventConflicts = detectEventConflicts;
window.expandEventsForWindow = expandEventsForWindow;
window.OVERLOAD_THRESHOLD = OVERLOAD_THRESHOLD;

// `state` mirror — read-through getter so inline `state.events` etc.
// resolve to the TS data layer's snapshot. The setter writes through.
// IMPORTANT: this is installed via Object.defineProperty so it overrides
// the inline `let state = ...` declaration (which is removed in TS-12's
// index.html edits below).
try {
  Object.defineProperty(window, 'state', {
    configurable: true,
    enumerable: true,
    get: () => getWorkspaceState(),
    set: (v: WorkspaceState) => { setWorkspaceState(v); },
  });
} catch (_e) {
  // If the inline `let state` ran first and defined a non-configurable
  // property, this throws. Fall back to a normal assignment — the
  // remaining inline code reads `state` directly via the let binding.
  console.warn('[TS-12] state mirror via defineProperty failed (likely shadowed by inline let).');
}

// Silence unused-import warnings for accessors used only by window mirrors.
void patchState;
void getDirtySectionsForStateKeys;
