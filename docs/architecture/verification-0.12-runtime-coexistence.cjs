/* ============================================================================
   Phase 0.12 — runtime coexistence verification
   ============================================================================
   Tests the 5 unverified coexistence risks listed in the 0.11 audit, by
   loading the REAL functions from index.html (calendar drag + account menu)
   into a node session with a mock `document` that counts listeners.

   The test is intentionally STRUCTURAL:
   - It calls the real attach/detach paths.
   - It does NOT exercise the visual drag (ghost positioning, drop-target
     detection) — those are not the subject of the audit.
   - It verifies listener-count invariants at each step of each scenario.

   Run with:  node docs/architecture/verification-0.12-runtime-coexistence.cjs
   ============================================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Mock document with listener tracking + queryable state
// ---------------------------------------------------------------------------
const docListeners = { click: [], keydown: [], pointermove: [], pointerup: [], pointercancel: [] };
const dispatchLog = [];

const document = {
  addEventListener(type, fn, opts) {
    docListeners[type] = docListeners[type] || [];
    docListeners[type].push({ fn, once: !!(opts && opts.once) });
    dispatchLog.push({ op: 'add', type, once: !!(opts && opts.once) });
  },
  removeEventListener(type, fn) {
    if (!docListeners[type]) return;
    const before = docListeners[type].length;
    docListeners[type] = docListeners[type].filter(l => l.fn !== fn);
    if (docListeners[type].length < before) {
      dispatchLog.push({ op: 'remove', type });
    }
  },
  // Stubs used by cleanup paths
  querySelectorAll(_sel) { return []; },
  querySelector(_sel) { return null; },
  getElementById(id) {
    if (id === 'accountMenu') return menuEl;
    if (id === 'userChip') return chipEl;
    // 0.14 — detailOverlay scenarios
    if (id === 'detailOverlay') return detailOverlayEl;
    if (id === 'detailKind') return detailKindEl;
    if (id === 'detailBody') return detailBodyEl;
    // 0.16 — 3 other modals
    if (id === 'eventModal') return eventModalEl;
    if (id === 'roleModal') return roleModalEl;
    if (id === 'inspiModal') return inspiModalEl;
    // detailPane intentionally not returned — fixed by 0.15. The 0.14
    // assertion that surfaced the typo remains in the harness as the
    // regression test.
    return null;
  },
  // Active element is consulted by the global ESC handler before deciding
  // whether to dismiss a modal. Default: nothing focused.
  activeElement: null,
  body: {
    style: { overflow: '' },
    appendChild() {},
    contains() { return false; },
  },
};

// ---------------------------------------------------------------------------
// Mock DOM elements involved
// ---------------------------------------------------------------------------
const menuEl = {
  hidden: true,
  contains() { return false; },
};
const chipEl = {
  contains() { return false; },
  closest(sel) { return sel === '#userChip' ? chipEl : null; },
};

// 0.14 — detailOverlay mocks
const detailOverlayState = { open: false };
const detailOverlayEl = {
  classList: {
    add(c) { if (c === 'open') detailOverlayState.open = true; },
    remove(c) { if (c === 'open') detailOverlayState.open = false; },
    contains(c) { return c === 'open' && detailOverlayState.open; },
  },
};
const detailKindEl = { textContent: '' };
const detailBodyEl = { innerHTML: '' };

// 0.16 — mocks for the 3 other modals (eventModal, roleModal, inspiModal).
// Each tracks open/closed state through the same classList shape so the real
// close functions and the global ESC routing can be exercised end-to-end.
function makeModalEl(_name) {
  const state = { open: false };
  const el = {
    _state: state,  // exposed for assertions
    classList: {
      add(c) { if (c === 'open') state.open = true; },
      remove(c) { if (c === 'open') state.open = false; },
      contains(c) { return c === 'open' && state.open; },
    },
  };
  return el;
}
const eventModalEl = makeModalEl('eventModal');
const roleModalEl = makeModalEl('roleModal');
const inspiModalEl = makeModalEl('inspiModal');

// A fake pill element used by the calendar drag handler.
function makePill(id) {
  return {
    dataset: { eventId: id },
    classList: { add() {}, remove() {} },
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 20 }; },
    setPointerCapture() {},
    releasePointerCapture() {},
    cloneNode() { return { classList: { add() {} }, style: {} }; },
    closest() { return null; },
    querySelector() { return null; },
  };
}

// ---------------------------------------------------------------------------
// Globals used by the extracted functions — stubbed to no-op
// ---------------------------------------------------------------------------
global.document = document;
global.window = { App: {}, scrollTo() {} };
// state.events.find is patched so resize/drag handlers always get a valid event
// regardless of the test's synthetic IDs. The real find() is kept for completeness
// but defaults to a generic event with a time field so the resize startMins check
// passes (the resize handler bails on startMins == null).
const _defaultEvent = { id: 'any', date: '2026-05-17', time: '10:00', duration: 60, title: 'fake' };
const _defaultTrack = { id: 'any-track', name: 'fake' };
global.state = { events: [_defaultEvent], tracks: [_defaultTrack] };
const _realFind = Array.prototype.find;
global.state.events.find = function (pred) {
  const hit = _realFind.call(this, pred);
  return hit || _defaultEvent;
};
global.state.tracks.find = function (pred) {
  const hit = _realFind.call(this, pred);
  return hit || _defaultTrack;
};
global.toast = () => {};
global.haptic = () => {};
global.renderCalendar = () => {};
global.renderDashboard = () => {};
// 0.14 — openDetail / closeDetail are now extracted from index.html below.
// The harness's previous stub assignments are kept here as fallbacks and
// will be overridden by the eval'd real implementations.
global.openDetail = () => {};
global.closeDetail = () => {};
// Stubs for the detail helpers openDetail calls. The harness doesn't
// exercise their rendering — they just need to not throw.
global.typeLabel = () => 'LBL';
global.detailEventHTML = () => '<div>fake-event</div>';
global.detailTrackHTML = () => '<div>fake-track</div>';
global.detailTodoHTML = () => '';
global.detailInspiHTML = () => '';
global.detailMemberHTML = () => '';
global.detailPhaseHTML = () => '';
global.hydrateDetailAudio = () => {};
global.hydrateDetailCover = () => {};
global.renderView = () => {};
global.getComputedStyle = (_el) => ({ display: 'block' });
global.save = () => {};
global._stampEventUpdate = () => {};
global._minsToTime = () => '10:00';
global._timeToMins = () => 600;
global._parseIso = () => new Date();
global._formatEventRange = () => '';
global._formatDuration = () => '';
global.disablePinOnThisDevice = () => {};
global.setTimeout = (fn) => { fn(); return 0; };  // synchronous for test determinism
global.clearTimeout = () => {};
global.MutationObserver = function () { return { observe() {}, disconnect() {} }; };
global.IntersectionObserver = function () { return { observe() {}, disconnect() {} }; };

// ---------------------------------------------------------------------------
// TS-6 — mirror state + helper stubs onto global.window for TS modules.
// ---------------------------------------------------------------------------
// The legacy inline functions resolved bare identifiers like `state.events`
// or `detailEventHTML(e)` against the Node `global` object (function decls
// hoist to global). TS modules use `window.state` / `window.detailEventHTML`
// — and in Node, `global.window` is a SEPARATE mock object, so we must
// mirror the stubs onto it explicitly. Without this mirroring, the TS
// `resolveKind()` returns null early because `window.detailEventHTML`
// looks undefined, and SC10–SC30 fail.
global.window.state = global.state;
global.window.PHASES = global.PHASES || {};
global.window.typeLabel = global.typeLabel;
global.window.detailEventHTML = global.detailEventHTML;
global.window.detailTrackHTML = global.detailTrackHTML;
global.window.detailTodoHTML = global.detailTodoHTML;
global.window.detailInspiHTML = global.detailInspiHTML;
global.window.detailMemberHTML = global.detailMemberHTML;
global.window.detailPhaseHTML = global.detailPhaseHTML;
global.window.renderView = global.renderView;
global.window.scrollTo = global.window.scrollTo || (() => {});

// ---------------------------------------------------------------------------
// Function extraction from index.html
// ---------------------------------------------------------------------------
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');

function extractFn(name) {
  // Find `function NAME(` at start of line, then scan for matching closing brace
  // at column 0 (function declarations in this file end with `^}$`).
  const startMatch = html.match(new RegExp('^function ' + name + '\\b[^{]*\\{', 'm'));
  if (!startMatch) throw new Error('Function not found: ' + name);
  const startIdx = startMatch.index;
  // Find first standalone closing brace at column 0 after the function start
  const after = html.slice(startIdx);
  const endRel = after.search(/\n\}\n/);
  if (endRel < 0) throw new Error('End not found for: ' + name);
  return after.slice(0, endRel + 3);
}

// Extract everything we need
const sources = [
  // Calendar week drag (5 fns)
  extractFn('_onWeekEventPointerDown'),
  extractFn('_onWeekEventPointerMove'),
  extractFn('_onWeekEventPointerUp'),
  extractFn('_onWeekDragKeydown'),
  extractFn('_cleanupWeekDrag'),
  // Calendar week resize (5 fns) — added in 0.13 T2
  extractFn('_onWeekEventResizeDown'),
  extractFn('_onWeekEventResizeMove'),
  extractFn('_onWeekEventResizeUp'),
  extractFn('_onWeekResizeKeydown'),
  extractFn('_cleanupWeekResize'),
  // Calendar month-grid drag (5 fns) — added in 0.13 T2
  extractFn('_onCalEventPointerDown'),
  extractFn('_onCalEventPointerMove'),
  extractFn('_onCalEventPointerUp'),
  extractFn('_onCalDragKeydown'),
  extractFn('_cleanupCalDrag'),
  // Account menu (4 fns) — toggleAccountMenu was renamed to
  // _toggleAccountMenuImpl in 0.13 T3 (legacy surface removed).
  extractFn('_accountMenuEscapeKey'),
  extractFn('_toggleAccountMenuImpl'),
  extractFn('_accountMenuOutsideClick'),
  extractFn('hideAccountMenu'),
  // 0.14 — detailOverlay lifecycle (T1 added try/catch on openDetail)
  // TS-6 — openDetail / closeDetail were MOVED to /src/features/detail/lifecycle.ts.
  // They are bundled via esbuild below (see __DETAIL_LIFECYCLE_BUNDLE__) and
  // re-injected into the harness scope as bare functions. They no longer
  // appear in index.html so extractFn() would throw on them.
  // 0.16 — close functions for the 3 other modals, so the global ESC
  // routing can drive them through their real close path (not a stub).
  // TS-9 — closeEventModal / closeRoleModal / closeInspiModal MOVED to
  // /src/features/modals/. They are bundled via esbuild below (see
  // __MODALS_BUNDLE__) and re-injected as bare globals. No longer in
  // index.html so extractFn() can't find them.
];

// 0.14 — extract the global ESC keydown handler from index.html and wrap
// it as a NAMED function `_globalEscRoutingFn` so it can be installed /
// uninstalled on demand. We deliberately do NOT auto-attach it at harness
// boot — only SC12 and SC13 need it; earlier scenarios expect zero baseline
// listeners.
function extractGlobalEscAsNamedFn() {
  const marker = '// ESC key closes any open modal';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error('Global ESC handler marker not found');
  const after = html.slice(start);
  const end = after.indexOf('\n});\n');
  if (end < 0) throw new Error('Global ESC handler closing not found');
  // Slice up to AND including the trailing `\n}` — drop the `);\n` of the
  // addEventListener call wrapper.
  // `\n});\n` is 5 chars; we want the substring ending at the `}` (so end+2 chars in).
  let block = after.slice(0, end + 2);  // includes `\n}`
  // Replace the addEventListener wrapper with a named function declaration.
  block = block.replace("document.addEventListener('keydown', (e) => {", 'function _globalEscRoutingFn(e) {');
  return block + '\n';
}
const globalEscNamedFn = extractGlobalEscAsNamedFn();
sources.push(globalEscNamedFn);

// 0.19 — same trick for the outside-click delegate at L17767.
function extractGlobalOutsideClickAsNamedFn() {
  const marker = '// Click outside modal to close';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error('Outside-click delegate marker not found');
  const after = html.slice(start);
  const end = after.indexOf('\n});\n');
  if (end < 0) throw new Error('Outside-click delegate closing not found');
  let block = after.slice(0, end + 2);
  block = block.replace("document.addEventListener('click', (e) => {", 'function _globalModalOutsideClickFn(e) {');
  return block + '\n';
}
const globalOutsideClickNamedFn = extractGlobalOutsideClickAsNamedFn();
sources.push(globalOutsideClickNamedFn);

// TS-10 — the physical-keyboard PIN handler MOVED to
// /src/features/auth/pin.ts (exported as `pinKeyboardHandler`).
// It is bundled via esbuild together with the rest of the auth module
// below (see __AUTH_BUNDLE__) and re-injected as the named global
// `_pinKeyboardHandlerFn` so SC22-24 / SC39 still drive the SAME real
// implementation — just imported through the build graph rather than
// scraped from index.html. The critical `offsetParent === null` gate
// is preserved verbatim in pin.ts.

// Account menu uses `const` and `let` in its body, but the functions
// themselves are plain. We also need to declare `_weekDrag` as a global
// because the calendar fns expect it as a module-level binding.
let _weekDrag = null;
global._weekDrag = _weekDrag;

// ---------------------------------------------------------------------------
// TS-6 — load openDetail / closeDetail from /src/features/detail/lifecycle.ts
// ---------------------------------------------------------------------------
// The lifecycle functions used to be inline in index.html; from TS-6 onward
// they are a typed TypeScript module. We bundle the module via esbuild's
// in-process API and inject the resulting CJS into the harness scope so
// existing SC10–SC13 / SC25–SC28 assertions keep exercising the SAME real
// implementation — just imported through the build graph rather than scraped
// from index.html.
const esbuild = require('esbuild');
const detailBundle = esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', '..', 'src', 'features', 'detail', 'lifecycle.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'es2020',
  write: false,
  logLevel: 'silent',
});
const detailCjs = detailBundle.outputFiles[0].text;
// Eval into an isolated `module.exports` so we don't pollute the harness.
// The bundled code references `window.*` which is `global.window` in node —
// our existing mock document/window setup provides those bindings.
const _detailMod = { exports: {} };
(function (module, exports, require) {
  // eslint-disable-next-line no-eval
  eval(detailCjs);
})(_detailMod, _detailMod.exports, require);
// Bundle output shape: `lifecycle_exports = { openDetail, closeDetail, bindDetailClose }`
// is assigned to `module.exports.openDetail` etc. via __toCommonJS helper.
const _detailExports = _detailMod.exports;
if (typeof _detailExports.openDetail !== 'function' || typeof _detailExports.closeDetail !== 'function') {
  throw new Error('TS-6 bundle did not yield openDetail / closeDetail exports — got: ' + Object.keys(_detailExports).join(','));
}
// Make them globals so the harness eval scope below picks them up by name.
global.openDetail = _detailExports.openDetail;
global.closeDetail = _detailExports.closeDetail;
global.bindDetailClose = _detailExports.bindDetailClose;

// ---------------------------------------------------------------------------
// TS-9 — load 3 modal close functions from /src/features/modals/.
// Same pattern as TS-6 detail: bundle via esbuild, eval in isolated scope,
// expose on globals for the harness eval scope below.
// ---------------------------------------------------------------------------
const modalsBundle = esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', '..', 'src', 'features', 'modals', 'index.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'es2020',
  write: false,
  logLevel: 'silent',
});
const modalsCjs = modalsBundle.outputFiles[0].text;
const _modalsMod = { exports: {} };
(function (module, exports, require) {
  // eslint-disable-next-line no-eval
  eval(modalsCjs);
})(_modalsMod, _modalsMod.exports, require);
const _modalsExports = _modalsMod.exports;
const _missingModalFns = ['closeEventModal', 'closeRoleModal', 'closeInspiModal']
  .filter(fn => typeof _modalsExports[fn] !== 'function');
if (_missingModalFns.length) {
  throw new Error('TS-9 bundle missing close fns: ' + _missingModalFns.join(','));
}
global.closeEventModal = _modalsExports.closeEventModal;
global.closeRoleModal = _modalsExports.closeRoleModal;
global.closeInspiModal = _modalsExports.closeInspiModal;
// Also expose the open / draft surface so the new modal-stability
// scenarios (added below) can exercise the real lifecycle.
global.openEventModal = _modalsExports.openEventModal;
global.openRoleModal = _modalsExports.openRoleModal;
global.openInspiLink = _modalsExports.openInspiLink;

// ---------------------------------------------------------------------------
// TS-10 — load auth foundation from /src/features/auth/.
// Same bundling pattern as TS-6/TS-9. Provides:
//   - _pinKeyboardHandlerFn — physical-keyboard PIN handler (was inline,
//     pinned by SC22-24, now pinned by SC39 too)
//   - pinKeyPress / pinDelete / submitPinBuffer / resetPinBuffer — buffer
//     manipulation, used by SC40 (lockout stability)
//   - setCurrentUser / getCurrentUser / logoutLocalState — session
//     accessors, used by SC41 (session cleanup symmetry)
//   - getPinLockState / recordPinFailure / clearPinFailures — lockout API
//     (the harness drives these directly to verify SC40 timing)
// ---------------------------------------------------------------------------
const authBundle = esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', '..', 'src', 'features', 'auth', 'index.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'es2020',
  write: false,
  logLevel: 'silent',
});
const authCjs = authBundle.outputFiles[0].text;
const _authMod = { exports: {} };
(function (module, exports, require) {
  // eslint-disable-next-line no-eval
  eval(authCjs);
})(_authMod, _authMod.exports, require);
const _authExports = _authMod.exports;
const _missingAuthFns = [
  'pinKeyboardHandler', 'pinKeyPress', 'pinDelete', 'submitPinBuffer',
  'resetPinBuffer', 'setCurrentUser', 'getCurrentUser', 'logoutLocalState',
  'getPinLockState', 'recordPinFailure', 'clearPinFailures',
].filter(fn => typeof _authExports[fn] !== 'function');
if (_missingAuthFns.length) {
  throw new Error('TS-10 bundle missing exports: ' + _missingAuthFns.join(','));
}
// Re-expose with the harness's historical names. The keyboard handler
// keeps its `_pinKeyboardHandlerFn` alias so SC22-24 reference doesn't move.
global._pinKeyboardHandlerFn = _authExports.pinKeyboardHandler;
global.pinKeyPress = _authExports.pinKeyPress;
global.pinDelete = _authExports.pinDelete;
global.submitPinBuffer = _authExports.submitPinBuffer;
global.resetPinBuffer = _authExports.resetPinBuffer;
global.setCurrentUser = _authExports.setCurrentUser;
global.getCurrentUser = _authExports.getCurrentUser;
global.logoutLocalState = _authExports.logoutLocalState;
global.getPinLockState_auth = _authExports.getPinLockState;
global.recordPinFailure_auth = _authExports.recordPinFailure;
global.clearPinFailures_auth = _authExports.clearPinFailures;

// Wrap in IIFE so the extracted functions live in a scope we control.
// We use `var` declarations explicitly (the extracted source uses `function`
// declarations which hoist).
const harness = `
  var _weekDrag = null;
  var _weekResize = null;
  var _calDrag = null;
  // 0.16 — module-level state nulled by the close functions
  var _pendingRoleKey = null;
  var _inspiDraft = null;
  ${sources.join('\n\n')}

  // Expose to outer for the test
  globalThis.__fns = {
    _onWeekEventPointerDown,
    _onWeekEventPointerMove,
    _onWeekEventPointerUp,
    _onWeekDragKeydown,
    _cleanupWeekDrag,
    _onWeekEventResizeDown,
    _onWeekEventResizeMove,
    _onWeekEventResizeUp,
    _onWeekResizeKeydown,
    _cleanupWeekResize,
    _onCalEventPointerDown,
    _onCalEventPointerMove,
    _onCalEventPointerUp,
    _onCalDragKeydown,
    _cleanupCalDrag,
    _accountMenuEscapeKey,
    _toggleAccountMenuImpl,
    _accountMenuOutsideClick,
    hideAccountMenu,
    openDetail,
    closeDetail,
    closeEventModal,
    closeRoleModal,
    closeInspiModal,
    // TS-9 — open surface of the 3 modals, loaded from the bundled TS
    // module above. Used by SC37 (re-open stability) and SC38 (ESC
    // precedence) to exercise the real lifecycle, not just the close path.
    openEventModal,
    openRoleModal,
    openInspiLink,
    _globalEscRoutingFn,
    _globalModalOutsideClickFn,
    _pinKeyboardHandlerFn,
  };
  globalThis.__getWeekDrag = function() { return _weekDrag; };
  globalThis.__getWeekResize = function() { return _weekResize; };
  globalThis.__getCalDrag = function() { return _calDrag; };
`;
eval(harness);
const F = global.__fns;
const getWeekDrag = global.__getWeekDrag;
const getWeekResize = global.__getWeekResize;
const getCalDrag = global.__getCalDrag;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
let pass = 0, fail = 0;
function eq(name, a, b) { const ok = JSON.stringify(a) === JSON.stringify(b); console.log((ok?'PASS ':'FAIL ')+name+(ok?'':'\n  exp: '+JSON.stringify(b)+'\n  got: '+JSON.stringify(a))); ok?pass++:fail++; }
function tr(name, v) { console.log((v?'PASS ':'FAIL ')+name); v?pass++:fail++; }

function listenerCounts() {
  return {
    click: docListeners.click.length,
    keydown: docListeners.keydown.length,
    pointermove: docListeners.pointermove.length,
    pointerup: docListeners.pointerup.length,
    pointercancel: docListeners.pointercancel.length,
  };
}
function resetState() {
  docListeners.click = [];
  docListeners.keydown = [];
  docListeners.pointermove = [];
  docListeners.pointerup = [];
  docListeners.pointercancel = [];
  dispatchLog.length = 0;
  menuEl.hidden = true;
  // Reset calendar state via cleanup paths
  if (getWeekDrag()) F._cleanupWeekDrag(null);
  if (getWeekResize()) F._cleanupWeekResize(null);
  if (getCalDrag()) F._cleanupCalDrag(null);
}

function fireDocClick(target) {
  const list = docListeners.click.slice();
  list.forEach(l => {
    l.fn({ target, preventDefault() {} });
    if (l.once) {
      const idx = docListeners.click.indexOf(l);
      if (idx >= 0) docListeners.click.splice(idx, 1);
    }
  });
}
function fireKey(key) {
  const list = docListeners.keydown.slice();
  list.forEach(l => l.fn({ key, preventDefault() {} }));
}
function firePointerUp(pointerId) {
  const list = docListeners.pointerup.slice();
  list.forEach(l => l.fn({ pointerId, clientX: 50, clientY: 50, preventDefault() {} }));
}

// Synthesize a "user starts a drag" event by calling the real pointerdown handler.
function startWeekDrag(pill, pointerId) {
  const ev = {
    pointerType: 'mouse', button: 0, pointerId,
    clientX: 10, clientY: 10,
    currentTarget: pill,
    target: pill,
    preventDefault() {}, stopPropagation() {},
  };
  F._onWeekEventPointerDown(ev);
}

// 0.13 T2 — extend the harness to week resize + cal-grid drag (same shape).
function startWeekResize(handle, pointerId) {
  const ev = {
    pointerType: 'mouse', button: 0, pointerId,
    clientX: 10, clientY: 10,
    currentTarget: handle,
    target: handle,
    preventDefault() {}, stopPropagation() {},
  };
  F._onWeekEventResizeDown(ev);
}
function startCalDrag(pill, pointerId) {
  const ev = {
    pointerType: 'mouse', button: 0, pointerId,
    clientX: 10, clientY: 10,
    currentTarget: pill,
    target: pill,
    preventDefault() {}, stopPropagation() {},
  };
  F._onCalEventPointerDown(ev);
}

// Helper to make a resize handle (the resize-down handler expects to find the
// parent pill via .closest('.cal-week-event[data-event-id]')).
function makeResizeHandle(pillId) {
  const pill = makePill(pillId);
  return {
    closest(sel) {
      if (sel === '.cal-week-event[data-event-id]') return pill;
      return null;
    },
    setPointerCapture() {},
    releasePointerCapture() {},
    classList: { add() {}, remove() {} },
    dataset: {},
  };
}

// Synthesize a "user clicks the chip" event by calling the real toggle impl.
// 0.13 T3: function renamed from toggleAccountMenu to _toggleAccountMenuImpl
// — same body, same behavior, just no longer a global surface.
function clickChip() {
  F._toggleAccountMenuImpl({ stopPropagation() {} });
}

// ---------------------------------------------------------------------------
// SANITY — baseline before any interaction
// ---------------------------------------------------------------------------
console.log('\n=== SANITY ===');
resetState();
eq('S1 initial listeners are all zero', listenerCounts(), { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });

// Verify the harness can independently exercise a calendar drag end-to-end.
const pill1 = makePill('evt-1');
startWeekDrag(pill1, 1);
eq('S2 after week-drag start: 1 pointermove + 1 pointerup + 1 pointercancel + 1 keydown', listenerCounts(), { click: 0, keydown: 1, pointermove: 1, pointerup: 1, pointercancel: 1 });
firePointerUp(1);
eq('S3 after pointerup: all listeners cleaned', listenerCounts(), { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });

// Verify the harness can independently exercise the account menu.
resetState();
clickChip(); // open
eq('S4 after chip click: menu open + 1 click + 1 keydown', { ...listenerCounts(), hidden: menuEl.hidden }, { click: 1, keydown: 1, pointermove: 0, pointerup: 0, pointercancel: 0, hidden: false });
clickChip(); // re-click closes
eq('S5 after re-click: menu closed + all listeners removed', { ...listenerCounts(), hidden: menuEl.hidden }, { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0, hidden: true });

// ---------------------------------------------------------------------------
// SCENARIO 1 — Drag actif + ouverture menu (no unexpected detach)
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 1 — drag active + menu open ===');
resetState();
const pillA = makePill('evt-A');
startWeekDrag(pillA, 1);
const dragOnly = listenerCounts();
clickChip(); // open menu MID-DRAG
const dragPlusMenu = listenerCounts();
eq('SC1.a drag-only baseline', dragOnly, { click: 0, keydown: 1, pointermove: 1, pointerup: 1, pointercancel: 1 });
eq('SC1.b after opening menu mid-drag: keydown grew 1→2, click grew 0→1, pointer listeners unchanged', dragPlusMenu, { click: 1, keydown: 2, pointermove: 1, pointerup: 1, pointercancel: 1 });
tr('SC1.c drag listeners (pointer*) were NOT detached by menu open', dragPlusMenu.pointermove === 1 && dragPlusMenu.pointerup === 1 && dragPlusMenu.pointercancel === 1);
tr('SC1.d menu is open', menuEl.hidden === false);

// Cleanup: end drag, close menu
firePointerUp(1);
F.hideAccountMenu();
eq('SC1.z after pointerup + hideAccountMenu: all clean', listenerCounts(), { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });

// ---------------------------------------------------------------------------
// SCENARIO 2 — ESC pendant drag avec menu ouvert
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 2 — ESC during drag + menu open ===');
resetState();
const pillB = makePill('evt-B');
startWeekDrag(pillB, 2);
clickChip(); // open menu
// At this point: 2 keydown listeners (drag + menu), 1 click (menu outside), 3 pointer
const before = listenerCounts();
eq('SC2.a before ESC: 2 keydown, 1 click, 3 pointer', before, { click: 1, keydown: 2, pointermove: 1, pointerup: 1, pointercancel: 1 });
tr('SC2.b _weekDrag is set before ESC', getWeekDrag() !== null);
fireKey('Escape');
// Both ESC handlers fire:
//  - _onWeekDragKeydown calls _cleanupWeekDrag → removes 4 listeners
//  - _accountMenuEscapeKey calls hideAccountMenu → removes 2 listeners
const after = listenerCounts();
eq('SC2.c after ESC: ALL listeners cleaned (both handlers fired their cleanup)', after, { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });
tr('SC2.d _weekDrag is null after ESC (drag canceled)', getWeekDrag() === null);
tr('SC2.e menu is closed after ESC', menuEl.hidden === true);
// CONCLUSION: ESC cancels BOTH drag and menu in one keypress. Both cleanup
// paths fire independently, no listener leak. UX-wise the user gets both
// dismissals; that may or may not be desired, but it is NOT a leak.

// ---------------------------------------------------------------------------
// SCENARIO 3 — Outside click menu pendant drag (no orphan listener)
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 3 — outside click on menu during drag ===');
resetState();
const pillC = makePill('evt-C');
startWeekDrag(pillC, 3);
clickChip(); // open menu
eq('SC3.a setup: drag + menu open', listenerCounts(), { click: 1, keydown: 2, pointermove: 1, pointerup: 1, pointercancel: 1 });
// Fire outside click — target is NEITHER menu nor chip
const outsideEl = { closest() { return null; } };
fireDocClick(outsideEl);
// menu's outside-click ({once:true}) auto-detaches AND calls hideAccountMenu → removes keydown too
const afterClick = listenerCounts();
eq('SC3.b after outside click: menu closed (click+keydown removed), drag listeners intact', afterClick, { click: 0, keydown: 1, pointermove: 1, pointerup: 1, pointercancel: 1 });
tr('SC3.c menu is closed', menuEl.hidden === true);
tr('SC3.d _weekDrag is STILL set (drag continues)', getWeekDrag() !== null);
// Now finish the drag cleanly
firePointerUp(3);
eq('SC3.e after pointerup: all clean', listenerCounts(), { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });

// ---------------------------------------------------------------------------
// SCENARIO 4 — Fin de drag après fermeture menu
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 4 — drag end after menu close ===');
resetState();
clickChip(); // open menu
F.hideAccountMenu(); // close menu explicitly
eq('SC4.a after open+close menu: clean', listenerCounts(), { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });
const pillD = makePill('evt-D');
startWeekDrag(pillD, 4);
eq('SC4.b after drag start: 4 listeners', listenerCounts(), { click: 0, keydown: 1, pointermove: 1, pointerup: 1, pointercancel: 1 });
firePointerUp(4);
eq('SC4.c after drag end: clean', listenerCounts(), { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });
tr('SC4.d _weekDrag null', getWeekDrag() === null);
tr('SC4.e menu closed', menuEl.hidden === true);

// ---------------------------------------------------------------------------
// SCENARIO 5 — Re-open menu après interaction mixte
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 5 — re-open menu after mixed interaction ===');
resetState();
// Sequence: drag start → menu open → outside click → drag end → menu reopen → menu close
const pillE = makePill('evt-E');
startWeekDrag(pillE, 5);
clickChip();
fireDocClick({ closest() { return null; } });
firePointerUp(5);
// Now re-open the menu
clickChip();
eq('SC5.a after sequence + menu reopen: 1 click + 1 keydown, drag clean', listenerCounts(), { click: 1, keydown: 1, pointermove: 0, pointerup: 0, pointercancel: 0 });
tr('SC5.b menu is open', menuEl.hidden === false);
F.hideAccountMenu();
eq('SC5.c after close: all clean', listenerCounts(), { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });

// ---------------------------------------------------------------------------
// SCENARIO 6 (bonus) — Stress: 50 alternating cycles
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 6 — 50 alternating drag/menu cycles ===');
resetState();
for (let i = 0; i < 50; i++) {
  // Half drag, half menu
  if (i % 2 === 0) {
    const pill = makePill('evt-' + i);
    startWeekDrag(pill, 100 + i);
    firePointerUp(100 + i);
  } else {
    clickChip();
    clickChip();
  }
}
eq('SC6 after 50 mixed cycles: ALL listeners 0', listenerCounts(), { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });
tr('SC6 _weekDrag null', getWeekDrag() === null);
tr('SC6 menu closed', menuEl.hidden === true);

// ===========================================================================
// 0.13 T2 — Extend to the 2 remaining calendar flows: week resize + cal-drag
// ===========================================================================

// ---------------------------------------------------------------------------
// SCENARIO 7 — Week resize: same invariants as week drag (sanity + coexistence)
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 7 — week resize × account menu coexistence ===');
resetState();
const handleA = makeResizeHandle('evt-resize-A');
startWeekResize(handleA, 10);
eq('SC7.a resize start: 4 listeners attached', listenerCounts(), { click: 0, keydown: 1, pointermove: 1, pointerup: 1, pointercancel: 1 });
tr('SC7.b _weekResize is set', getWeekResize() !== null);
clickChip(); // open menu mid-resize
eq('SC7.c menu open mid-resize: keydown grew 1→2, click grew 0→1, pointer intact', listenerCounts(), { click: 1, keydown: 2, pointermove: 1, pointerup: 1, pointercancel: 1 });
// ESC during resize + menu open: both cleanups should fire
fireKey('Escape');
eq('SC7.d ESC mid-resize-with-menu: all clean', listenerCounts(), { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });
tr('SC7.e _weekResize null after ESC', getWeekResize() === null);
tr('SC7.f menu closed after ESC', menuEl.hidden === true);

// Outside click during resize: menu closes, resize listeners untouched
resetState();
const handleB = makeResizeHandle('evt-resize-B');
startWeekResize(handleB, 11);
clickChip();
fireDocClick({ closest() { return null; } });
eq('SC7.g outside click during resize: resize listeners intact', listenerCounts(), { click: 0, keydown: 1, pointermove: 1, pointerup: 1, pointercancel: 1 });
tr('SC7.h _weekResize STILL set (resize continues)', getWeekResize() !== null);
firePointerUp(11);
eq('SC7.i resize end after menu close: all clean', listenerCounts(), { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });

// ---------------------------------------------------------------------------
// SCENARIO 8 — Cal-grid drag: same invariants as week drag (sanity + coexistence)
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 8 — cal-grid drag × account menu coexistence ===');
resetState();
const pillCG_A = makePill('evt-cg-A');
startCalDrag(pillCG_A, 20);
eq('SC8.a cal-grid drag start: 4 listeners attached', listenerCounts(), { click: 0, keydown: 1, pointermove: 1, pointerup: 1, pointercancel: 1 });
tr('SC8.b _calDrag is set', getCalDrag() !== null);
clickChip();
eq('SC8.c menu open mid-cal-drag: 1 click + 2 keydown + 3 pointer', listenerCounts(), { click: 1, keydown: 2, pointermove: 1, pointerup: 1, pointercancel: 1 });
fireKey('Escape');
eq('SC8.d ESC mid-cal-drag-with-menu: all clean', listenerCounts(), { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });
tr('SC8.e _calDrag null after ESC', getCalDrag() === null);
tr('SC8.f menu closed after ESC', menuEl.hidden === true);

// Outside click during cal-drag: menu closes, drag listeners untouched
resetState();
const pillCG_B = makePill('evt-cg-B');
startCalDrag(pillCG_B, 21);
clickChip();
fireDocClick({ closest() { return null; } });
eq('SC8.g outside click during cal-drag: drag listeners intact', listenerCounts(), { click: 0, keydown: 1, pointermove: 1, pointerup: 1, pointercancel: 1 });
tr('SC8.h _calDrag STILL set', getCalDrag() !== null);
firePointerUp(21);
eq('SC8.i cal-drag end after menu close: all clean', listenerCounts(), { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });

// ---------------------------------------------------------------------------
// SCENARIO 9 — All three calendar flows + menu in alternating stress (30 cycles)
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 9 — 30 mixed cycles across all 3 calendar flows + menu ===');
resetState();
for (let i = 0; i < 30; i++) {
  const which = i % 4;
  if (which === 0) {
    const p = makePill('w-' + i);
    startWeekDrag(p, 200 + i);
    firePointerUp(200 + i);
  } else if (which === 1) {
    const h = makeResizeHandle('r-' + i);
    startWeekResize(h, 300 + i);
    firePointerUp(300 + i);
  } else if (which === 2) {
    const p = makePill('c-' + i);
    startCalDrag(p, 400 + i);
    firePointerUp(400 + i);
  } else {
    clickChip();
    clickChip();
  }
}
eq('SC9 after 30 mixed cycles across all flows: ALL listeners 0', listenerCounts(), { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });
tr('SC9 _weekDrag null', getWeekDrag() === null);
tr('SC9 _weekResize null', getWeekResize() === null);
tr('SC9 _calDrag null', getCalDrag() === null);
tr('SC9 menu closed', menuEl.hidden === true);

// ===========================================================================
// 0.14 — detailOverlay × account menu coexistence (added per 0.14 brief)
//
// T1 introduced a new runtime behavior on openDetail: an exception thrown
// after `body.style.overflow = 'hidden'` triggers a rollback (restore
// overflow + remove 'open' + rethrow). None of SC1-SC9 covered:
//   - coexistence between body.overflow-locking overlays and other runtime
//     interactions,
//   - exception-rollback under coexistence,
//   - ordering of cleanups when multiple subsystems touch document-level
//     state.
//
// SC10-SC13 close that gap. Scope strict: detailOverlay × account menu
// only. No calendar. No other modals.
// ===========================================================================

function resetDetailState() {
  detailOverlayState.open = false;
  document.body.style.overflow = '';
}

// Helpers to install / uninstall the global ESC routing handler.
// SC12 + SC13 need it; earlier scenarios assume zero baseline.
function installGlobalEsc() {
  document.addEventListener('keydown', F._globalEscRoutingFn);
}
function uninstallGlobalEsc() {
  document.removeEventListener('keydown', F._globalEscRoutingFn);
}

// 0.19 — outside-click delegate (covers eventModal + inspiModal only;
// roleModal uses a separate inline backdrop handler)
function installGlobalOutsideClick() {
  document.addEventListener('click', F._globalModalOutsideClickFn);
}
function uninstallGlobalOutsideClick() {
  document.removeEventListener('click', F._globalModalOutsideClickFn);
}

// ---------------------------------------------------------------------------
// SCENARIO 10 — Open detail → open menu → close menu
//   Invariant: closing the menu does NOT restore body.style.overflow.
//               The overlay remains the sole owner of the lock.
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 10 — open detail × open menu × close menu ===');
resetState();
resetDetailState();
F.openDetail('event', 'evt-1');
eq('SC10.a after openDetail: overlay open', detailOverlayState.open, true);
eq('SC10.b after openDetail: body.overflow locked', document.body.style.overflow, 'hidden');
clickChip();  // open menu
eq('SC10.c after menu open: 1 click + 1 keydown listener on doc', listenerCounts(), { click: 1, keydown: 1, pointermove: 0, pointerup: 0, pointercancel: 0 });
F.hideAccountMenu();  // close menu only
eq('SC10.d body.overflow STILL locked after menu close', document.body.style.overflow, 'hidden');
tr('SC10.e overlay STILL open after menu close', detailOverlayState.open === true);
eq('SC10.f menu doc listeners removed (0 / 0)', listenerCounts(), { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });

// ---------------------------------------------------------------------------
// SCENARIO 11 — Open detail → open menu → exception thrown inside openDetail
//   We simulate the T1 path: an exception after the body.overflow lock.
//   T1's catch should restore overflow + close overlay + rethrow, AND must
//   not leak menu-related listeners (the menu opening happens BEFORE the
//   exception in this construction).
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 11 — open detail × open menu × exception during a SECOND openDetail call ===');
resetState();
resetDetailState();
// First openDetail succeeds (sets overflow, opens overlay)
F.openDetail('event', 'evt-1');
clickChip();  // open menu
eq('SC11.a setup ok', { open: detailOverlayState.open, overflow: document.body.style.overflow, listeners: listenerCounts() },
   { open: true, overflow: 'hidden', listeners: { click: 1, keydown: 1, pointermove: 0, pointerup: 0, pointercancel: 0 } });

// Now make a SECOND openDetail call that will throw mid-flow.
// TS-6 NOTE: we used to patch `global.hydrateDetailAudio` to throw, but
// since the lifecycle TS module imports hydrate from `./hydrate` at bundle
// time, that import binding cannot be swapped via globals. We instead patch
// `window.scrollTo` which is ALSO inside the same try-block in openDetail
// (right before the hydrate calls). The T1 rollback contract under test is
// identical — "if anything in the post-lock try-block throws synchronously,
// overflow restored + .open removed + rethrow."
const originalScrollTo = global.window.scrollTo;
global.window.scrollTo = () => { throw new Error('idb-down'); };
let caught = null;
try { F.openDetail('track', 't1'); } catch (e) { caught = e.message; }
global.window.scrollTo = originalScrollTo;

tr('SC11.b exception rethrown from openDetail', caught === 'idb-down');
eq('SC11.c body.overflow RESTORED by T1 catch', document.body.style.overflow, '');
tr('SC11.d overlay closed by T1 catch', detailOverlayState.open === false);
// Menu listeners are independent — they should still be attached because
// the exception was in openDetail, not in the menu lifecycle.
eq('SC11.e menu listeners still attached after exception (independent)', listenerCounts(), { click: 1, keydown: 1, pointermove: 0, pointerup: 0, pointercancel: 0 });
F.hideAccountMenu();
eq('SC11.f menu cleanup still works after exception', listenerCounts(), { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });

// ---------------------------------------------------------------------------
// SCENARIO 12 — Open detail → ESC (no menu)
//   The legacy global ESC handler at L17740 in index.html is supposed to
//   route ESC to closeDetail when detail is open. Verify that path works.
//
//   NOTE on what this scenario will surface: index.html L17766 queries
//   `document.getElementById('detailPane')` while the actual overlay
//   element is `detailOverlay`. The harness mock therefore returns null
//   for 'detailPane' (matching real-DOM behavior). If the handler relies
//   solely on this lookup to dismiss the detail view, ESC will not close
//   the overlay. The scenario verifies what the brief asks; the result
//   reflects the actual current behavior.
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 12 — open detail × ESC ===');
resetState();
resetDetailState();
installGlobalEsc();
F.openDetail('event', 'evt-1');
eq('SC12.a setup: detail open, overflow locked, 1 keydown listener (global ESC)',
   { open: detailOverlayState.open, overflow: document.body.style.overflow, listeners: listenerCounts().keydown },
   { open: true, overflow: 'hidden', listeners: 1 });

// Fire ESC
fireKey('Escape');
console.log('SC12.b after ESC: overlay state =', detailOverlayState.open, '(brief expects false)');
console.log('SC12.c after ESC: body.overflow =', JSON.stringify(document.body.style.overflow), "(brief expects '')");
const sc12_overlayClosed = detailOverlayState.open === false;
const sc12_overflowReset = document.body.style.overflow === '';
tr('SC12.b after ESC: overlay closed (brief expectation)', sc12_overlayClosed);
tr('SC12.c after ESC: body.overflow restored (brief expectation)', sc12_overflowReset);
uninstallGlobalEsc();
// If SC12.b/c FAIL, it surfaces the index.html L17766 detailPane / detailOverlay
// id mismatch — a real defect the brief asked us to verify against.

// ---------------------------------------------------------------------------
// SCENARIO 13 — Open detail → open menu → ESC
//   Critical real-world coexistence case. Two keydown handlers exist:
//     - _accountMenuEscapeKey (menu-specific)
//     - the global L17740 handler (routes to closeDetail when detail open)
//   Both fire on ESC. Verify the final state is consistent: menu closed,
//   overlay closed, overflow reset, 0 leftover listeners.
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 13 — open detail × open menu × ESC ===');
resetState();
resetDetailState();
installGlobalEsc();
F.openDetail('event', 'evt-1');
clickChip();  // open menu — adds 1 click + 1 keydown
eq('SC13.a setup: detail+menu open, 1 click + 2 keydown (menu + global)',
   { open: detailOverlayState.open, overflow: document.body.style.overflow, listeners: listenerCounts() },
   { open: true, overflow: 'hidden', listeners: { click: 1, keydown: 2, pointermove: 0, pointerup: 0, pointercancel: 0 } });

fireKey('Escape');
// Brief's expected end state:
const sc13_overlayClosed = detailOverlayState.open === false;
const sc13_overflowReset = document.body.style.overflow === '';
const sc13_menuClosed = menuEl.hidden === true;
const sc13_listenersZero = JSON.stringify(listenerCounts()) === JSON.stringify({ click: 0, keydown: 1, pointermove: 0, pointerup: 0, pointercancel: 0 });
// keydown=1 because the global ESC routing fn is still attached (not auto-uninstalled).
// The brief said "0 listeners restants" — we interpret that as ZERO MENU-related
// listeners + ZERO overlay-related listeners. The global ESC handler is
// architecturally always-on (legacy installation), so leaving it attached
// matches real-product behavior.

tr('SC13.b after ESC: menu closed', sc13_menuClosed);
tr('SC13.c after ESC: overlay closed (brief expectation)', sc13_overlayClosed);
tr('SC13.d after ESC: body.overflow restored (brief expectation)', sc13_overflowReset);
tr('SC13.e after ESC: only global ESC listener remains (menu listeners cleaned)', sc13_listenersZero);

console.log('SC13 details: overlay.open =', detailOverlayState.open, ', overflow =', JSON.stringify(document.body.style.overflow), ', menu.hidden =', menuEl.hidden, ', listenerCounts =', JSON.stringify(listenerCounts()));
uninstallGlobalEsc();

// ===========================================================================
// 0.16 — Global ESC routing to the OTHER 3 modals
//
// The 0.13 T4 finding claimed (correctly) that ESC works for eventModal,
// inspiModal, roleModal via the global keydown handler at L17740. That
// claim was based on source reading, not automated test. 0.14 then proved
// the same source reading was IMPLICITLY wrong for detailOverlay (the
// L17766 typo); 0.15 fixed it.
//
// SC14-SC16 convert the T4 trust into a runtime invariant: each modal
// type opened in isolation must be closed by ESC, with the correct
// dispatch path through the global handler.
//
// Scope strict: only the ESC routing path. Not outside-click. Not modal
// coexistence with each other. Each scenario tests ONE modal.
// ===========================================================================

// ---------------------------------------------------------------------------
// SCENARIO 14 — eventModal × ESC
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 14 — eventModal × ESC ===');
resetState();
installGlobalEsc();
eventModalEl.classList.add('open');
eq('SC14.a setup: eventModal open, 1 keydown (global ESC), 0 others',
   { open: eventModalEl._state.open, listeners: listenerCounts() },
   { open: true, listeners: { click: 0, keydown: 1, pointermove: 0, pointerup: 0, pointercancel: 0 } });
fireKey('Escape');
tr('SC14.b after ESC: eventModal closed', eventModalEl._state.open === false);
uninstallGlobalEsc();

// ---------------------------------------------------------------------------
// SCENARIO 15 — inspiModal × ESC
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 15 — inspiModal × ESC ===');
resetState();
installGlobalEsc();
inspiModalEl.classList.add('open');
eq('SC15.a setup: inspiModal open',
   { open: inspiModalEl._state.open, listeners: listenerCounts() },
   { open: true, listeners: { click: 0, keydown: 1, pointermove: 0, pointerup: 0, pointercancel: 0 } });
fireKey('Escape');
tr('SC15.b after ESC: inspiModal closed', inspiModalEl._state.open === false);
uninstallGlobalEsc();

// ---------------------------------------------------------------------------
// SCENARIO 16 — roleModal × ESC
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 16 — roleModal × ESC ===');
resetState();
installGlobalEsc();
roleModalEl.classList.add('open');
eq('SC16.a setup: roleModal open',
   { open: roleModalEl._state.open, listeners: listenerCounts() },
   { open: true, listeners: { click: 0, keydown: 1, pointermove: 0, pointerup: 0, pointercancel: 0 } });
fireKey('Escape');
tr('SC16.b after ESC: roleModal closed', roleModalEl._state.open === false);
uninstallGlobalEsc();

// ===========================================================================
// 0.17a — Global ESC + focused-input contract
//
// The global ESC handler at L17740 has a focus-respect clause:
//   if (active.tagName === 'INPUT' || 'TEXTAREA' || isContentEditable):
//     active.blur(); return;
// This means: ESC pressed while typing in an input does NOT close the modal
// — it first blurs the input. The user must press ESC again to close.
//
// This is a fragile contract: if someone refactors the focus check (or
// inverts the early return), inputs become uncloseable-via-ESC OR modals
// become un-closeable while inputs exist anywhere on the page. SC17/SC18
// pin the contract.
// ===========================================================================

// Helper: simulate a focused input
function setActiveInput(tagName, isContentEditable) {
  const el = {
    tagName: (tagName || 'INPUT').toUpperCase(),
    isContentEditable: !!isContentEditable,
    _blurred: false,
    blur() { this._blurred = true; document.activeElement = null; },
  };
  document.activeElement = el;
  return el;
}

// ---------------------------------------------------------------------------
// SCENARIO 17 — ESC with focused input → blur, no modal close
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 17 — ESC with focused input does NOT close modals ===');
resetState();
installGlobalEsc();
eventModalEl.classList.add('open');
const focusedInput = setActiveInput('INPUT');
eq('SC17.a setup: modal open, input focused', { open: eventModalEl._state.open, focused: document.activeElement && document.activeElement.tagName }, { open: true, focused: 'INPUT' });
fireKey('Escape');
tr('SC17.b after ESC: input was blurred', focusedInput._blurred === true);
tr('SC17.c after ESC: modal STILL open (focus-respect contract)', eventModalEl._state.open === true);
eq('SC17.d activeElement cleared by blur', document.activeElement, null);
uninstallGlobalEsc();
eventModalEl.classList.remove('open');

// ---------------------------------------------------------------------------
// SCENARIO 18 — ESC after blur (or never-focused) → modal closes
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 18 — ESC with no focused input DOES close modal ===');
resetState();
installGlobalEsc();
eventModalEl.classList.add('open');
document.activeElement = null;  // explicit: no input focused
fireKey('Escape');
tr('SC18.a after ESC (no focus): modal closed', eventModalEl._state.open === false);
uninstallGlobalEsc();

// Same check for TEXTAREA (per the handler's check), to verify the regex
// isn't INPUT-only.
console.log('\n=== SCENARIO 18b — ESC with focused TEXTAREA also blurs ===');
resetState();
installGlobalEsc();
roleModalEl.classList.add('open');
const focusedTextarea = setActiveInput('TEXTAREA');
fireKey('Escape');
tr('SC18b.a textarea blurred', focusedTextarea._blurred === true);
tr('SC18b.b roleModal STILL open', roleModalEl._state.open === true);
uninstallGlobalEsc();
roleModalEl.classList.remove('open');

// And isContentEditable
console.log('\n=== SCENARIO 18c — ESC with contentEditable also blurs ===');
resetState();
installGlobalEsc();
inspiModalEl.classList.add('open');
const focusedCE = setActiveInput('DIV', true);
fireKey('Escape');
tr('SC18c.a contentEditable element blurred', focusedCE._blurred === true);
tr('SC18c.b inspiModal STILL open', inspiModalEl._state.open === true);
uninstallGlobalEsc();
inspiModalEl.classList.remove('open');

// ===========================================================================
// 0.19 — Outside-click delegate (eventModal + inspiModal)
//
// The L17767 document-click delegate routes a click whose target.id is
// 'eventModal' or 'inspiModal' to the corresponding close fn. This is the
// backdrop-click-to-close pattern for those 2 modals. roleModal uses an
// inline backdrop handler instead (different mechanism, not covered here).
//
// SC19/SC20 pin the contract: clicking outside the modal content (i.e.
// directly on the backdrop element whose id matches) closes the modal.
// Clicking inside the content (different target id) does not.
// ===========================================================================

// Helper: fire a document click whose e.target has a specific id
function fireDocClickOnId(id) {
  const list = docListeners.click.slice();
  const target = { id, closest() { return null; } };
  list.forEach(l => {
    l.fn({ target });
    if (l.once) {
      const idx = docListeners.click.indexOf(l);
      if (idx >= 0) docListeners.click.splice(idx, 1);
    }
  });
}

// ---------------------------------------------------------------------------
// SCENARIO 19 — eventModal × outside-click via delegate
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 19 — eventModal × backdrop click ===');
resetState();
installGlobalOutsideClick();
eventModalEl.classList.add('open');
eq('SC19.a setup', { open: eventModalEl._state.open, listeners: listenerCounts() },
   { open: true, listeners: { click: 1, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 } });

// Click INSIDE the modal (target id is some child) → should NOT close
fireDocClickOnId('some-child-of-modal');
tr('SC19.b click inside modal does NOT close (target id mismatch)', eventModalEl._state.open === true);

// Click ON the backdrop (target id === 'eventModal') → closes
fireDocClickOnId('eventModal');
tr('SC19.c backdrop click closes eventModal', eventModalEl._state.open === false);
uninstallGlobalOutsideClick();

// ---------------------------------------------------------------------------
// SCENARIO 20 — inspiModal × outside-click via delegate
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 20 — inspiModal × backdrop click ===');
resetState();
installGlobalOutsideClick();
inspiModalEl.classList.add('open');
eq('SC20.a setup', { open: inspiModalEl._state.open, listeners: listenerCounts() },
   { open: true, listeners: { click: 1, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 } });

// Click inside → NOT close
fireDocClickOnId('some-child');
tr('SC20.b inside click does NOT close', inspiModalEl._state.open === true);

// Backdrop click → closes
fireDocClickOnId('inspiModal');
tr('SC20.c backdrop click closes inspiModal', inspiModalEl._state.open === false);
uninstallGlobalOutsideClick();

// ---------------------------------------------------------------------------
// SCENARIO 21 — Delegate does NOT route to roleModal
//   (roleModal uses a separate inline backdrop handler at L7231; the
//   delegate has no branch for it. Verifying explicitly to prevent
//   future "homogenization" refactors that would silently break.)
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 21 — delegate has NO route for roleModal ===');
resetState();
installGlobalOutsideClick();
roleModalEl.classList.add('open');
fireDocClickOnId('roleModal');
tr('SC21.a clicking with id=roleModal via the delegate does NOT close roleModal (different mechanism)', roleModalEl._state.open === true);
uninstallGlobalOutsideClick();
roleModalEl.classList.remove('open');

// ===========================================================================
// 0.20 — Physical keyboard PIN handler (L10664)
//
// The handler typed-digit → pinKeyPress and Backspace/Delete → pinDelete,
// GATED on `pinView.offsetParent !== null` (i.e. the PIN entry view is
// visible). The previous-and-wrong check `pinView.style.display === 'none'`
// caused a global Backspace-swallow bug; the offsetParent check fixed it.
// Pinning the offsetParent contract here prevents the bug from returning
// if anyone reverts the check.
// ===========================================================================

// Mock the PIN entry view + the digit/delete sink fns.
const pinViewState = { hidden: true };  // true === offsetParent null (hidden)
const pinViewEl = {
  get offsetParent() { return pinViewState.hidden ? null : { _isParent: true }; },
};

// Extend getElementById for authPinEntryView
const _origGetById = document.getElementById;
document.getElementById = function (id) {
  if (id === 'authPinEntryView') return pinViewEl;
  return _origGetById.call(document, id);
};

// TS-10 — the bundled `_pinKeyboardHandlerFn` imports pinKeyPress /
// pinDelete from ./pin at build time, so we can't spy via global
// assignment any more. We check the observable buffer state
// (`_authExports.getPinBuffer()`) instead — same contract, just
// downstream of the call. Helpers below mirror the old spy shape
// to keep SC22/SC23/SC24 assertion text stable.
const getPinBufferAuth = () => _authExports.getPinBuffer();
const resetPinBufferAuth = () => _authExports.resetPinBuffer();
let pinPressCalls = [];   // last digits pressed since last reset
let pinDeleteCalls = 0;   // count of backspace/delete fires since last reset
let _bufferBefore = '';   // snapshot so we can detect press / delete events
function _refreshPinSpies() {
  const now = getPinBufferAuth();
  if (now.length > _bufferBefore.length) {
    // 1+ digits added — record the last one (we only press one at a time)
    pinPressCalls.push(now.slice(-1));
  } else if (now.length < _bufferBefore.length) {
    pinDeleteCalls += 1;
  }
  _bufferBefore = now;
}
// Make them visible to the eval'd handler too (eval'd code uses bare names).
// The harness's IIFE eval scope captures globals at call time, so this works.

function installPinKeyboard() {
  document.addEventListener('keydown', F._pinKeyboardHandlerFn);
}
function uninstallPinKeyboard() {
  document.removeEventListener('keydown', F._pinKeyboardHandlerFn);
}

function fireKeyWith(key, modifiers) {
  const list = docListeners.keydown.slice();
  const ev = {
    key,
    metaKey: !!(modifiers && modifiers.meta),
    ctrlKey: !!(modifiers && modifiers.ctrl),
    altKey: !!(modifiers && modifiers.alt),
    preventDefault() {},
  };
  list.forEach(l => l.fn(ev));
  // After firing, refresh the observable-state spies so SC22/SC23/SC24
  // assertions keep their original shape.
  _refreshPinSpies();
}

// ---------------------------------------------------------------------------
// SCENARIO 22 — PIN keyboard active when view visible
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 22 — pin keyboard handler (visible) ===');
resetState();
installPinKeyboard();
pinViewState.hidden = false;  // pinView visible (offsetParent != null)
resetPinBufferAuth();
pinPressCalls = [];
pinDeleteCalls = 0;
_bufferBefore = '';

fireKeyWith('5');
eq('SC22.a digit pressed → pinKeyPress("5") called', pinPressCalls, ['5']);

fireKeyWith('Backspace');
eq('SC22.b Backspace pressed → pinDelete called', pinDeleteCalls, 1);

// Re-press a digit so the next Delete has something to remove. The TS
// `pinDelete` early-returns on empty buffer (kept verbatim from the
// inline original) — observable-state spy only counts effects.
fireKeyWith('5');
fireKeyWith('Delete');
eq('SC22.c Delete pressed → pinDelete called again', pinDeleteCalls, 2);

// Non-digit, non-Backspace key passes through
fireKeyWith('a');
fireKeyWith('Enter');
fireKeyWith('Tab');
// SC22.a digit + SC22.c digit = ['5','5']. Other keys must not add more.
eq('SC22.d other keys → no pinKeyPress', pinPressCalls, ['5','5']);
eq('SC22.e other keys → no pinDelete', pinDeleteCalls, 2);

uninstallPinKeyboard();

// ---------------------------------------------------------------------------
// SCENARIO 23 — PIN keyboard gated by offsetParent (the documented critical fix)
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 23 — pin keyboard handler (HIDDEN via offsetParent) ===');
resetState();
installPinKeyboard();
pinViewState.hidden = true;  // pinView HIDDEN (offsetParent === null)
resetPinBufferAuth();
pinPressCalls = [];
pinDeleteCalls = 0;
_bufferBefore = '';

fireKeyWith('5');
fireKeyWith('Backspace');
fireKeyWith('Delete');
tr('SC23.a HIDDEN view → digit does NOT call pinKeyPress (offsetParent gate)', pinPressCalls.length === 0);
tr('SC23.b HIDDEN view → Backspace does NOT call pinDelete (offsetParent gate)', pinDeleteCalls === 0);

uninstallPinKeyboard();

// ---------------------------------------------------------------------------
// SCENARIO 24 — PIN keyboard ignores modifier keys
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 24 — pin keyboard handler (modifiers) ===');
resetState();
installPinKeyboard();
pinViewState.hidden = false;
resetPinBufferAuth();
pinPressCalls = [];
pinDeleteCalls = 0;
_bufferBefore = '';

fireKeyWith('5', { ctrl: true });
fireKeyWith('5', { meta: true });
fireKeyWith('5', { alt: true });
tr('SC24.a Ctrl/Meta/Alt + digit → NOT routed', pinPressCalls.length === 0);
fireKeyWith('Backspace', { ctrl: true });
tr('SC24.b Ctrl + Backspace → NOT routed', pinDeleteCalls === 0);

// And a normal digit still works
fireKeyWith('5');
eq('SC24.c plain digit still works after modifier tests', pinPressCalls, ['5']);

uninstallPinKeyboard();

// ===========================================================================
// 0.21 — Interaction interruption scenarios
//
// Tests cross-state transitions: what happens when one runtime interaction
// is INTERRUPTED by another that mutates global state. This is the class
// of bug that typically surfaces only after a feature is added downstream,
// when no one re-tests the existing interaction matrix. Harness pins them
// pre-emptively.
//
// Scope strict: only the harness extension. Real fns extracted as before.
// If any scenario FAILs, it's a real defect → separate PR (like 0.14→0.15).
// ===========================================================================

// ---------------------------------------------------------------------------
// SC25 — openDetail() called twice in a row
//   Invariants: no listener duplication, body.overflow consistent, overlay
//   open exactly once at end (subsequent classList.add('open') is a noop).
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 25 — openDetail called twice ===');
resetState();
resetDetailState();
const listenersBefore = JSON.stringify(listenerCounts());
F.openDetail('event', 'evt-A');
const afterFirst = {
  open: detailOverlayState.open,
  overflow: document.body.style.overflow,
  listeners: JSON.stringify(listenerCounts()),
};
F.openDetail('event', 'evt-B');
const afterSecond = {
  open: detailOverlayState.open,
  overflow: document.body.style.overflow,
  listeners: JSON.stringify(listenerCounts()),
};
eq('SC25.a listeners stable across both calls', afterFirst.listeners, listenersBefore);
eq('SC25.b listeners still stable after 2nd call', afterSecond.listeners, listenersBefore);
tr('SC25.c overlay open after 1st', afterFirst.open === true);
tr('SC25.d overlay still open after 2nd (idempotent)', afterSecond.open === true);
eq('SC25.e body.overflow consistent after 1st', afterFirst.overflow, 'hidden');
eq('SC25.f body.overflow consistent after 2nd', afterSecond.overflow, 'hidden');

// ---------------------------------------------------------------------------
// SC26 — menu open → openDetail → ESC
//   Both menu and detail get closed by one ESC press. The menu's own
//   _accountMenuEscapeKey fires (closes menu); the global ESC routing fires
//   too and reaches the detail branch (no other modals open) → closeDetail.
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 26 — menu open → openDetail → ESC ===');
resetState();
resetDetailState();
installGlobalEsc();
clickChip();  // menu open: 1 click + 1 keydown
F.openDetail('event', 'evt-C');  // detail open: body.overflow=hidden + overlay.open
eq('SC26.a setup: menu open + detail open + global ESC armed',
   { menu: !menuEl.hidden, detail: detailOverlayState.open, overflow: document.body.style.overflow, listeners: listenerCounts() },
   { menu: true, detail: true, overflow: 'hidden', listeners: { click: 1, keydown: 2, pointermove: 0, pointerup: 0, pointercancel: 0 } });

fireKey('Escape');

tr('SC26.b menu closed', menuEl.hidden === true);
tr('SC26.c overlay closed', detailOverlayState.open === false);
eq('SC26.d body.overflow restored', document.body.style.overflow, '');
// keydown=1 = the global ESC routing fn (always-on while installed); menu's
// keydown was removed by hideAccountMenu; click was the menu's outside-click
// listener — also removed.
eq('SC26.e doc listeners: only the global ESC routing fn remains',
   listenerCounts(),
   { click: 0, keydown: 1, pointermove: 0, pointerup: 0, pointercancel: 0 });
uninstallGlobalEsc();

// ---------------------------------------------------------------------------
// SC27 — drag active → openDetail (mid-drag) → drag cleanup
//   Interruption: detailOverlay opens while a drag is in progress. The
//   drag listeners must NOT leak when the drag eventually ends, and the
//   detail state must be consistent.
//   NOTE: ending the drag via pointerup also CALLS openDetail (the legacy
//   pointerup handler routes click-like pointer-ups to openDetail). So the
//   final state has detail open from BOTH paths. SC25 already verified
//   the double-open is idempotent.
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 27 — drag active → openDetail → drag cleanup ===');
resetState();
resetDetailState();
const pill27 = makePill('evt-D');
startWeekDrag(pill27, 27);
eq('SC27.a drag started: 4 listeners + no detail', { open: detailOverlayState.open, listeners: listenerCounts() },
   { open: false, listeners: { click: 0, keydown: 1, pointermove: 1, pointerup: 1, pointercancel: 1 } });

// Open detail mid-drag (simulates: user opened detail via some other UI
// while a drag is in flight — e.g., realtime sync or programmatic open)
F.openDetail('event', 'evt-other');
eq('SC27.b mid-drag openDetail: detail open + body locked, drag listeners INTACT',
   { open: detailOverlayState.open, overflow: document.body.style.overflow, listeners: listenerCounts() },
   { open: true, overflow: 'hidden', listeners: { click: 0, keydown: 1, pointermove: 1, pointerup: 1, pointercancel: 1 } });

// End the drag
firePointerUp(27);
eq('SC27.c after drag end: all drag listeners cleaned, detail still consistent',
   { open: detailOverlayState.open, overflow: document.body.style.overflow, listeners: listenerCounts() },
   { open: true, overflow: 'hidden', listeners: { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 } });
tr('SC27.d _weekDrag is null after cleanup', getWeekDrag() === null);

// ---------------------------------------------------------------------------
// SC28 — modal open → detailOverlay open → ESC
//   The global ESC handler routes through eventModal/inspiModal/roleModal
//   BEFORE reaching the detail branch. So with eventModal open AND detail
//   open, one ESC press closes only eventModal. A SECOND ESC press then
//   reaches the detail branch and closes the overlay.
//   This pins the close-order contract. If the if-branches in the global
//   handler are reordered, the order changes, and this scenario catches it.
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 28 — modal open + detail open + ESC routing order ===');
resetState();
resetDetailState();
installGlobalEsc();
eventModalEl.classList.add('open');
F.openDetail('event', 'evt-E');
eq('SC28.a setup: eventModal open + detail open + body locked',
   { event: eventModalEl._state.open, detail: detailOverlayState.open, overflow: document.body.style.overflow },
   { event: true, detail: true, overflow: 'hidden' });

// First ESC: should close ONLY eventModal (per the handler's branch order)
fireKey('Escape');
eq('SC28.b 1st ESC: eventModal closed, detail STILL open, overflow STILL locked',
   { event: eventModalEl._state.open, detail: detailOverlayState.open, overflow: document.body.style.overflow },
   { event: false, detail: true, overflow: 'hidden' });

// Second ESC: now reaches the detail branch (no modals open) → closes
fireKey('Escape');
eq('SC28.c 2nd ESC: detail closed, overflow restored',
   { event: eventModalEl._state.open, detail: detailOverlayState.open, overflow: document.body.style.overflow },
   { event: false, detail: false, overflow: '' });
uninstallGlobalEsc();

// ===========================================================================
// 0.22 — Repetition stress (listener integrity under intensive cycling)
//
// Detects silent accumulation that single-pass scenarios miss: a single
// extra add/remove pair per cycle is invisible at N=1, lethal at N=100.
// Each scenario tracks listener counts cycle-by-cycle to verify the
// counts NEVER drift above expected MAX, and return to exactly 0 at the
// end.
// ===========================================================================

// Helper: returns true if any listener count is non-zero at this moment.
function anyDocListener() {
  const c = listenerCounts();
  return c.click + c.keydown + c.pointermove + c.pointerup + c.pointercancel > 0;
}

// ---------------------------------------------------------------------------
// SC29 — Account menu open/close ×100 via outside-click
//   For each cycle: open via clickChip, close via outside click. Track the
//   max simultaneous listeners and the final count.
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 29 — account menu open/close ×100 ===');
resetState();
let maxClick = 0, maxKeydown = 0;
const outsideTarget = { closest() { return null; } };
for (let i = 0; i < 100; i++) {
  clickChip();  // open
  const c1 = listenerCounts();
  if (c1.click > maxClick) maxClick = c1.click;
  if (c1.keydown > maxKeydown) maxKeydown = c1.keydown;
  fireDocClick(outsideTarget);  // close via outside click
}
eq('SC29.a max simultaneous click listeners across 100 cycles', maxClick, 1);
eq('SC29.b max simultaneous keydown listeners across 100 cycles', maxKeydown, 1);
eq('SC29.c after 100 open/close cycles: all listeners back to 0', listenerCounts(), { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });
tr('SC29.d menu in final closed state', menuEl.hidden === true);

// ---------------------------------------------------------------------------
// SC30 — detailOverlay open/close ×100
//   Verifies body.overflow is restored exactly each cycle (no asymmetric
//   accumulation: e.g. overflow set twice without reset).
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 30 — detailOverlay open/close ×100 ===');
resetState();
resetDetailState();
let allOverflowRestores = true;
let allOpenStates = true;
let allFinalCloses = true;
for (let i = 0; i < 100; i++) {
  F.openDetail('event', 'evt-stress-' + i);
  if (document.body.style.overflow !== 'hidden') allOverflowRestores = false;
  if (!detailOverlayState.open) allOpenStates = false;
  F.closeDetail();
  if (document.body.style.overflow !== '') allFinalCloses = false;
  if (detailOverlayState.open) allFinalCloses = false;
}
tr('SC30.a 100 opens: overflow was always set to "hidden" right after open', allOverflowRestores);
tr('SC30.b 100 opens: overlay state was always open right after open', allOpenStates);
tr('SC30.c 100 closes: overflow was always restored to "" + overlay closed', allFinalCloses);
eq('SC30.d final body.overflow restored', document.body.style.overflow, '');
tr('SC30.e final overlay closed', detailOverlayState.open === false);
eq('SC30.f doc listeners untouched (openDetail does not add doc listeners)', listenerCounts(), { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });

// ---------------------------------------------------------------------------
// SC31 — Modal ESC cycles ×100 (per modal type)
//   For each of eventModal / inspiModal / roleModal: open via classList,
//   ESC, repeat 100×. Verify each close fn was called exactly 100×, and
//   no doc listener leak.
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 31 — modal ESC cycles ×100 each ===');

function stressModalESC(modalEl, name) {
  resetState();
  installGlobalEsc();
  let closeCount = 0;
  // Wrap the close path so we count calls via a state observation
  for (let i = 0; i < 100; i++) {
    modalEl.classList.add('open');
    fireKey('Escape');
    if (modalEl._state.open === false) closeCount++;
  }
  uninstallGlobalEsc();
  return { closeCount, listeners: listenerCounts() };
}

const ev31 = stressModalESC(eventModalEl, 'eventModal');
eq('SC31.a eventModal closed exactly 100 times across 100 ESC cycles', ev31.closeCount, 100);
eq('SC31.b eventModal: no doc listener leak', ev31.listeners, { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });

const ins31 = stressModalESC(inspiModalEl, 'inspiModal');
eq('SC31.c inspiModal closed exactly 100 times', ins31.closeCount, 100);
eq('SC31.d inspiModal: no doc listener leak', ins31.listeners, { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });

const rol31 = stressModalESC(roleModalEl, 'roleModal');
eq('SC31.e roleModal closed exactly 100 times', rol31.closeCount, 100);
eq('SC31.f roleModal: no doc listener leak', rol31.listeners, { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });

// ---------------------------------------------------------------------------
// SC32 — Mixed sequence stress ×25
//   Each iteration:
//     open menu → open detail → ESC (closes both) → open eventModal → ESC
//     → drag start → drag cleanup
//   Verifies that ALL paths combined return cleanly with no cumulative drift.
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 32 — mixed sequence stress ×25 ===');
resetState();
resetDetailState();
installGlobalEsc();
let mixedMaxClick = 0, mixedMaxKeydown = 0, mixedMaxPointer = 0;
let mixedFailures = [];
for (let i = 0; i < 25; i++) {
  // Phase 1: open menu + open detail
  clickChip();
  F.openDetail('event', 'mix-' + i);

  // Phase 2: ESC closes both (per SC26 invariant)
  fireKey('Escape');
  if (!menuEl.hidden || detailOverlayState.open || document.body.style.overflow !== '') {
    mixedFailures.push('iter ' + i + ' phase 2: menu=' + !menuEl.hidden + ' detail=' + detailOverlayState.open + ' overflow=' + JSON.stringify(document.body.style.overflow));
    break;
  }

  // Phase 3: open eventModal + ESC
  eventModalEl.classList.add('open');
  fireKey('Escape');
  if (eventModalEl._state.open) {
    mixedFailures.push('iter ' + i + ' phase 3: eventModal still open');
    break;
  }

  // Phase 4: drag start + cleanup
  const pillMix = makePill('mix-pill-' + i);
  startWeekDrag(pillMix, 1000 + i);
  const c = listenerCounts();
  if (c.click > mixedMaxClick) mixedMaxClick = c.click;
  if (c.keydown > mixedMaxKeydown) mixedMaxKeydown = c.keydown;
  if (c.pointermove > mixedMaxPointer) mixedMaxPointer = c.pointermove;
  firePointerUp(1000 + i);  // pointerup → cleanup → also calls openDetail
  // openDetail was called by pointerup. closeDetail to reset for next iter.
  F.closeDetail();
}
uninstallGlobalEsc();

eq('SC32.a no per-iteration failures recorded', mixedFailures, []);
eq('SC32.b max simultaneous keydown across 25 iters (drag+global ESC)', mixedMaxKeydown, 2);
eq('SC32.c max simultaneous pointermove', mixedMaxPointer, 1);
eq('SC32.d final listeners 0', listenerCounts(), { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });
tr('SC32.e final menu closed', menuEl.hidden === true);
tr('SC32.f final detail closed', detailOverlayState.open === false);
tr('SC32.g final eventModal closed', eventModalEl._state.open === false);
eq('SC32.h final body.overflow restored', document.body.style.overflow, '');
tr('SC32.i _weekDrag null after cycle', getWeekDrag() === null);

// ===========================================================================
// 0.23 — Storage failure suite
//
// Tests UI lifecycle behavior when localStorage misbehaves: setItem throws
// (QuotaExceededError), getItem returns invalid JSON, storage becomes
// unavailable mid-sequence. The lifecycle paths extracted into this
// harness (modals, detailOverlay, account menu, drag/drop, ESC routing)
// don't directly call localStorage in their bodies — they delegate to
// helpers like save() which are stubbed to no-op. So this suite verifies
// the ARCHITECTURAL PROPERTY that lifecycle is storage-independent:
// a storage failure cannot corrupt the open/close paths because they
// don't depend on storage.
// ===========================================================================

// Storage mock with toggle-able failure mode.
// TS-10 update — 'ok' mode now uses a real backing Map so SC40 can drive
// recordPinFailure / getPinLockState across multiple calls (the original
// always-null getItem made the lockout counter unable to accumulate).
// Failure modes (setItem-throws / getItem-invalid-json / unavailable)
// still bypass the Map so SC33-36 assertions stay valid.
const storageMock = {
  _mode: 'ok',  // 'ok' | 'setItem-throws' | 'getItem-invalid-json' | 'unavailable'
  _setItemCount: 0,
  _getItemCount: 0,
  _store: new Map(),
  setItem(k, v) {
    this._setItemCount++;
    if (this._mode === 'setItem-throws' || this._mode === 'unavailable') {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    }
    this._store.set(k, String(v));
  },
  getItem(k) {
    this._getItemCount++;
    if (this._mode === 'unavailable') {
      throw new Error('SecurityError');
    }
    if (this._mode === 'getItem-invalid-json') {
      return '{{{not-valid-json}}}';
    }
    return this._store.has(k) ? this._store.get(k) : null;
  },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};
global.localStorage = storageMock;

// Helper to reset all the mock counters before a test
function resetStorageMock(mode) {
  storageMock._mode = mode || 'ok';
  storageMock._setItemCount = 0;
  storageMock._getItemCount = 0;
}

// Run a representative set of lifecycle ops and capture both
// (a) any exception that propagated out, and (b) the final harness state.
function runLifecycleBundleAndCapture(label) {
  const errs = [];
  function safeRun(name, fn) {
    try { fn(); } catch (e) { errs.push({ name, msg: e.message }); }
  }
  resetState();
  resetDetailState();
  installGlobalEsc();
  safeRun('menu-open', () => clickChip());
  safeRun('menu-close', () => F.hideAccountMenu());
  safeRun('openDetail', () => F.openDetail('event', 'storage-' + label));
  safeRun('closeDetail', () => F.closeDetail());
  // Modal open + ESC
  safeRun('modal-open', () => eventModalEl.classList.add('open'));
  safeRun('esc-fire', () => fireKey('Escape'));
  // Drag start + cleanup
  safeRun('drag-start', () => startWeekDrag(makePill('storage-pill-' + label), 9000));
  safeRun('drag-end', () => firePointerUp(9000));
  safeRun('closeDetail-post-drag', () => F.closeDetail());
  uninstallGlobalEsc();
  return {
    errs,
    listeners: listenerCounts(),
    overflow: document.body.style.overflow,
    menuClosed: menuEl.hidden === true,
    detailClosed: detailOverlayState.open === false,
    eventModalClosed: eventModalEl._state.open === false,
    weekDragNull: getWeekDrag() === null,
  };
}

// ---------------------------------------------------------------------------
// SC33 — localStorage.setItem throws QuotaExceededError during lifecycle ops
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 33 — localStorage.setItem throws during lifecycle ===');
resetStorageMock('setItem-throws');
const sc33 = runLifecycleBundleAndCapture('33');
eq('SC33.a no exception propagated from lifecycle ops', sc33.errs, []);
eq('SC33.b final listeners 0', sc33.listeners, { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });
eq('SC33.c body.overflow restored', sc33.overflow, '');
tr('SC33.d menu closed', sc33.menuClosed);
tr('SC33.e detail closed', sc33.detailClosed);
tr('SC33.f eventModal closed', sc33.eventModalClosed);
tr('SC33.g drag state null', sc33.weekDragNull);
// Architectural finding: the lifecycle paths in this harness DID NOT touch
// localStorage at all (count = 0). They are storage-independent by design.
eq('SC33.h FINDING: lifecycle ops invoked localStorage.setItem ZERO times', storageMock._setItemCount, 0);

// ---------------------------------------------------------------------------
// SC34 — getItem returns invalid JSON
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 34 — localStorage.getItem returns invalid JSON ===');
resetStorageMock('getItem-invalid-json');
const sc34 = runLifecycleBundleAndCapture('34');
eq('SC34.a no exception propagated', sc34.errs, []);
eq('SC34.b final listeners 0', sc34.listeners, { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });
tr('SC34.c all UI states closed', sc34.menuClosed && sc34.detailClosed && sc34.eventModalClosed);
eq('SC34.d FINDING: lifecycle ops invoked localStorage.getItem ZERO times', storageMock._getItemCount, 0);

// ---------------------------------------------------------------------------
// SC35 — storage unavailable mid-sequence (mode toggled between ops)
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 35 — storage becomes unavailable mid-sequence ===');
resetState();
resetDetailState();
installGlobalEsc();
resetStorageMock('ok');
const errs35 = [];
function safe35(name, fn) { try { fn(); } catch (e) { errs35.push({ name, msg: e.message }); } }
safe35('menu-open-with-storage-ok', () => clickChip());
// Toggle storage off mid-flow
resetStorageMock('unavailable');
safe35('detail-open-with-storage-down', () => F.openDetail('event', 'evt-35'));
safe35('esc-with-storage-down', () => fireKey('Escape'));
uninstallGlobalEsc();
eq('SC35.a no exception propagated even with storage down mid-flow', errs35, []);
tr('SC35.b menu closed', menuEl.hidden === true);
tr('SC35.c detail closed', detailOverlayState.open === false);
eq('SC35.d final listeners 0', listenerCounts(), { click: 0, keydown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 });
eq('SC35.e body.overflow restored', document.body.style.overflow, '');

// ---------------------------------------------------------------------------
// SC36 — repeated persistence failures ×50
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 36 — repeated persistence failures ×50 ===');
resetStorageMock('setItem-throws');
let cumulativeErrs = [];
let maxListeners = 0;
for (let i = 0; i < 50; i++) {
  const r = runLifecycleBundleAndCapture('36-' + i);
  if (r.errs.length) cumulativeErrs = cumulativeErrs.concat(r.errs.map(e => 'iter ' + i + ': ' + e.name + ' / ' + e.msg));
  const total = r.listeners.click + r.listeners.keydown + r.listeners.pointermove + r.listeners.pointerup + r.listeners.pointercancel;
  if (total > maxListeners) maxListeners = total;
}
eq('SC36.a no exception across 50 iterations with setItem always throwing', cumulativeErrs.slice(0, 3), []);
eq('SC36.b max listeners at end of any iteration: 0 (no cumulative drift)', maxListeners, 0);

// Reset storage to OK so any subsequent debugging is sane
resetStorageMock('ok');

// ===========================================================================
// SCENARIO 37 — Modal re-open stability (TS-9 — added with modals extraction)
// ===========================================================================
// Open / close ×50 for each modal. Verify after each cycle:
//   - no residual document keydown listener (the modal lifecycle itself
//     attaches none; SC37 confirms it stays that way after a stress run)
//   - no double-attach drift (count never exceeds 1 — the global ESC handler
//     attached once at scenario start)
//   - the closed-state of each modal element resets cleanly
// ===========================================================================
console.log('\n=== SCENARIO 37 — modal re-open stability ×50 each ===');
resetState();
resetDetailState();
installGlobalEsc(); // baseline keydown listener (1)
const baselineKeydown = listenerCounts().keydown;

// Force-reset each modal's open state. The harness's makeModalEl mocks
// have a `_state.open` flag tracked through classList.add('open').
function resetModal(el) {
  el.classList.remove('open');
}
resetModal(eventModalEl);
resetModal(roleModalEl);
resetModal(inspiModalEl);

let modalCycleErrs = [];
for (let i = 0; i < 50; i++) {
  try {
    F.openEventModal();
    F.closeEventModal();
    F.openInspiLink();
    F.closeInspiModal();
    // roleModal needs a populated ROLES list; otherwise its open is a no-op
    // (the harness doesn't set ROLES on window). We still exercise the close
    // path to confirm hideModal doesn't accumulate listeners.
    F.closeRoleModal();
  } catch (e) {
    modalCycleErrs.push(String(i) + ':' + e.message);
  }
}

eq('SC37.a no exception across 50 open/close cycles', modalCycleErrs.slice(0, 3), []);
eq('SC37.b keydown listeners unchanged (baseline preserved)', listenerCounts().keydown, baselineKeydown);
eq('SC37.c no click/pointer listeners leaked', { click: listenerCounts().click, pointermove: listenerCounts().pointermove }, { click: 0, pointermove: 0 });
tr('SC37.d eventModal closed', eventModalEl._state.open === false);
tr('SC37.e roleModal closed', roleModalEl._state.open === false);
tr('SC37.f inspiModal closed', inspiModalEl._state.open === false);

uninstallGlobalEsc();

// ===========================================================================
// SCENARIO 38 — ESC precedence: modal closes BEFORE detail (TS-9)
// ===========================================================================
// The 0.21 SC28 already verified the modal-vs-detail close order on the
// global ESC routing. SC38 re-runs that contract against the post-TS-9
// modals — same expectation: ESC closes the modal first, detail still
// open, body.overflow still locked. Second ESC closes detail.
// ===========================================================================
console.log('\n=== SCENARIO 38 — ESC precedence: modal closes BEFORE detail (TS-9) ===');
resetState();
resetDetailState();
installGlobalEsc();

// Open detail then eventModal
F.openDetail('event', 'evt-1');
eventModalEl.classList.add('open');
eq('SC38.a setup: detail open + eventModal open + body locked', {
  detail: detailOverlayState.open,
  modal: eventModalEl._state.open,
  overflow: document.body.style.overflow,
}, { detail: true, modal: true, overflow: 'hidden' });

// First ESC — modal closes, detail stays open.
// The mock document doesn't auto-dispatch; iterate the listener list
// directly (same pattern SC28 uses).
const escEvent = { key: 'Escape', target: { tagName: 'BODY' } };
docListeners.keydown.forEach(l => l.fn(escEvent));
tr('SC38.b after 1st ESC: eventModal closed', eventModalEl._state.open === false);
tr('SC38.c after 1st ESC: detail STILL open', detailOverlayState.open === true);
eq('SC38.d after 1st ESC: body.overflow STILL locked', document.body.style.overflow, 'hidden');

// Second ESC — detail closes
docListeners.keydown.forEach(l => l.fn(escEvent));
tr('SC38.e after 2nd ESC: detail closed', detailOverlayState.open === false);
eq('SC38.f after 2nd ESC: body.overflow restored', document.body.style.overflow, '');

uninstallGlobalEsc();

// ===========================================================================
// SCENARIO 39 — Hidden PIN view keyboard isolation (TS-10)
// ===========================================================================
// Pins the historical "Backspace swallowed globally" bug. Contract:
//   - PIN view HIDDEN (offsetParent === null) → Backspace MUST NOT be
//     intercepted (pinDelete is not called, preventDefault is not called).
//   - PIN view VISIBLE (offsetParent !== null) → Backspace IS intercepted.
//
// Stronger than SC22/23 because SC39 explicitly toggles visibility
// between firings and verifies the gate flips on every transition.
// ===========================================================================
console.log('\n=== SCENARIO 39 — hidden PIN view keyboard isolation (TS-10) ===');
resetState();
installPinKeyboard();

// Track preventDefault calls so we can prove the handler is genuinely
// inert when the view is hidden (no e.preventDefault, no buffer change).
let _preventCount = 0;
function fireKeyTracked(key) {
  const list = docListeners.keydown.slice();
  const ev = {
    key, metaKey: false, ctrlKey: false, altKey: false,
    preventDefault() { _preventCount += 1; },
  };
  list.forEach(l => l.fn(ev));
  _refreshPinSpies();
}

// Visible → Backspace is handled (preventDefault + pinDelete fired)
pinViewState.hidden = false;
resetPinBufferAuth();
_bufferBefore = '';
pinPressCalls = [];
pinDeleteCalls = 0;
_preventCount = 0;
fireKeyTracked('5');               // buffer = '5'
fireKeyTracked('Backspace');       // buffer = ''
eq('SC39.a VISIBLE: digit + Backspace fully handled', { p: pinPressCalls, d: pinDeleteCalls, pd: _preventCount }, { p: ['5'], d: 1, pd: 2 });

// Hidden → ALL keys pass through (no preventDefault, no buffer change)
pinViewState.hidden = true;
resetPinBufferAuth();
_bufferBefore = '';
pinPressCalls = [];
pinDeleteCalls = 0;
_preventCount = 0;
fireKeyTracked('5');
fireKeyTracked('Backspace');
fireKeyTracked('Delete');
fireKeyTracked('7');
eq('SC39.b HIDDEN: 0 preventDefault calls (key events propagate normally)', _preventCount, 0);
eq('SC39.c HIDDEN: 0 buffer mutations (handler inert)', { p: pinPressCalls.length, d: pinDeleteCalls }, { p: 0, d: 0 });
eq('SC39.d HIDDEN: pin buffer stays empty', getPinBufferAuth(), '');

// Toggle back to visible — must re-arm cleanly
pinViewState.hidden = false;
fireKeyTracked('3');
eq('SC39.e re-VISIBLE: handler re-armed immediately', getPinBufferAuth(), '3');

uninstallPinKeyboard();

// ===========================================================================
// SCENARIO 40 — Lockout stability (TS-10)
// ===========================================================================
// Drive the storage layer directly through `recordPinFailure` to verify
// the escalation table (3/30s, 6/5min, 10/30min, 15/signOut) and that
// repeated calls don't drift counter / corrupt state.
// ===========================================================================
console.log('\n=== SCENARIO 40 — lockout stability (TS-10) ===');
// localStorage mock (already used by SC33-36) — clear any leftover lock row.
resetStorageMock('ok');
const TEST_UID = 'test-user-sc40';
try { localStorage.removeItem('degzzy_pin_lock_' + TEST_UID); } catch (_e) {}

// Drive the raw lockout API directly via the bundle's exports (matches
// how the inline submitPinBuffer uses them in production). All take
// the userId explicitly so the test is hermetic.
const rec = (uid) => _authExports.recordPinFailure(uid);
const getLock = (uid) => _authExports.getPinLockState(uid);
const clear = (uid) => _authExports.clearPinFailures(uid);

// Drive 14 failures (just under SIGNOUT). Each call returns the updated
// `{count, lockedUntil}` — count should equal i+1 each time, no drift.
let _sc40LockSnapshots = [];
for (let i = 0; i < 14; i++) {
  const r = rec(TEST_UID);
  _sc40LockSnapshots.push({ count: r.count, locked: r.lockedUntil > 0 });
}

// Threshold transitions: 3=W30S, 6=W5MIN, 10=W30MIN (locked: true)
//                       counts 1,2,4,5,7,8,9,11,12,13 should also be locked
//                       (the lock-until carries over until cleared / expired)
eq('SC40.a count grew monotonically from 1 to 14', _sc40LockSnapshots.map(s => s.count), [1,2,3,4,5,6,7,8,9,10,11,12,13,14]);

// At count 3, lock kicks in (30s). At 6 it escalates (5min). At 10 (30min).
// All snapshots from index 2 (count=3) onward should be `locked: true`.
tr('SC40.b lockout fires at count=3 (W30S)', _sc40LockSnapshots[2].locked === true);
tr('SC40.c lockout still active at count=5', _sc40LockSnapshots[4].locked === true);
tr('SC40.d lockout escalation at count=6 (W5MIN)', _sc40LockSnapshots[5].locked === true);
tr('SC40.e lockout escalation at count=10 (W30MIN)', _sc40LockSnapshots[9].locked === true);

// 15th failure triggers SIGNOUT threshold (1h). Counter saturates at 15.
const r15 = rec(TEST_UID);
tr('SC40.f count=15 = SIGNOUT threshold reached', r15.count === 15);
tr('SC40.g count=15 lock is set to a future deadline (~1h ahead)', r15.lockedUntil > Date.now() + 30 * 60 * 1000);

// `getPinLockState` reads the live storage and computes remainingSec.
const finalState = getLock(TEST_UID);
tr('SC40.h getPinLockState reads consistent count', finalState.count === 15);
tr('SC40.i getPinLockState reports isLocked', finalState.isLocked === true);
tr('SC40.j remainingSec is in (0, 3600] range', finalState.remainingSec > 0 && finalState.remainingSec <= 3600);

// Clear API resets to zero
clear(TEST_UID);
const cleared = getLock(TEST_UID);
eq('SC40.k clearPinFailures resets state', cleared, { count: 0, lockedUntil: 0, isLocked: false, remainingSec: 0 });

// ===========================================================================
// SCENARIO 41 — Session cleanup symmetry (TS-10)
// ===========================================================================
// Open session → mutate state → logout → re-open. Verify:
//   - logoutLocalState() clears _currentUser, _currentProfile, PIN buffer
//   - re-setting currentUser does not resurrect stale PIN state
//   - lockout row from a previous user does not leak (cleared explicitly)
// ===========================================================================
console.log('\n=== SCENARIO 41 — session cleanup symmetry (TS-10) ===');

// Reset PIN buffer in case a prior scenario left a digit behind.
_authExports.resetPinBuffer();

// Open session — set a user, push some PIN failures, drop a digit in the buffer
_authExports.setCurrentUser({ id: 'u1', email: 'one@test' });
_authExports.setCurrentProfile({ name: 'User One', role: 'Autre' });
_authExports.recordPinFailure('u1');
_authExports.recordPinFailure('u1');
// Drop a digit into the buffer via the public API (the handler does this
// in production; harness drives it directly).
_authExports.pinKeyPress('7');

eq('SC41.a setup: user + profile set, lockout count=2, buffer="7"', {
  uid: _authExports.getCurrentUser()?.id,
  name: _authExports.getCurrentProfile()?.name,
  count: _authExports.getPinLockState('u1').count,
  buf: _authExports.getPinBuffer(),
}, { uid: 'u1', name: 'User One', count: 2, buf: '7' });

// Logout — sync local cleanup
_authExports.logoutLocalState();
eq('SC41.b after logoutLocalState: user cleared', _authExports.getCurrentUser(), null);
eq('SC41.c after logoutLocalState: profile cleared', _authExports.getCurrentProfile(), null);
eq('SC41.d after logoutLocalState: PIN buffer reset', _authExports.getPinBuffer(), '');

// Lockout STATE is preserved (per-user, persisted in localStorage). The
// inline signOutUser path is responsible for clearing the storage row when
// the user resets their PIN — this is correct behavior per the auth audit.
const lockedAfter = _authExports.getPinLockState('u1');
tr('SC41.e lockout row persists for u1 (correct — auth audit C)', lockedAfter.count === 2);

// Re-open session with a DIFFERENT user — verify no leakage from u1
_authExports.setCurrentUser({ id: 'u2', email: 'two@test' });
const u2Lock = _authExports.getPinLockState('u2');
eq('SC41.f re-login as u2: u2 lockout is fresh (no leak from u1)', u2Lock, { count: 0, lockedUntil: 0, isLocked: false, remainingSec: 0 });

// Cleanup
_authExports.clearPinFailures('u1');
_authExports.setCurrentUser(null);
_authExports.setCurrentProfile(null);
try { localStorage.removeItem('degzzy_pin_lock_u1'); } catch (_e) {}

// ===========================================================================
// TS-11 ASYNC BLOCK — SC42 / SC43 / SC44 need real async/await semantics
// (Supabase mock returns Promises). CommonJS doesn't support top-level
// await; wrap the trio in an async IIFE and `process.exit` at the end.
// ===========================================================================
(async () => {
// ===========================================================================
// SCENARIO 42 — Auth state transition symmetry (TS-11)
// ===========================================================================
// Drive the TS auth-state orchestrator through SIGNED_OUT → SIGNED_IN →
// SIGNED_OUT using a mock Supabase client. Verify:
//   - listeners attach + detach cleanly
//   - currentUser/currentProfile mirrors stay coherent across transitions
//   - logoutLocalState() fires the registered PIN reset (cross-wire intact)
// ===========================================================================
console.log('\n=== SCENARIO 42 — auth state transition symmetry (TS-11) ===');

// Build a mock Supabase auth client whose onAuthStateChange callback
// can be driven manually. signOut is a no-op that returns success.
let _sc42Callback = null;
let _sc42Subscribed = false;
const _sc42MockSb = {
  auth: {
    signInWithPassword: async () => ({ data: { user: { id: 'sc42-user', email: 's42@test' }, session: null }, error: null }),
    signUp: async () => ({ data: { user: null, session: null }, error: null }),
    signOut: async () => ({ error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: (cb) => {
      _sc42Callback = cb;
      _sc42Subscribed = true;
      return { data: { subscription: { unsubscribe: () => { _sc42Subscribed = false; _sc42Callback = null; } } } };
    },
  },
};

// Wire the TS orchestrator to the mock + attach listener
_authExports.setSupabaseClient(_sc42MockSb);
_authExports._resetSignOutTracking();

// Register lifecycle hooks for SC42 — we observe the calls.
let _sc42CleanupCalls = 0;
let _sc42ReloadCalls = 0;
_authExports.registerAuthLifecycleHooks({
  cleanupRealtimeChannels: () => { _sc42CleanupCalls += 1; },
  reload: () => { _sc42ReloadCalls += 1; },
  loadProfile: async () => ({ name: 'SC42 Profile', role: 'Autre' }),
  postAuthFlow: async () => { /* no-op */ },
  showResetPassword: () => { /* no-op */ },
});

const detachSc42 = _authExports.attachAuthStateListener();
tr('SC42.a listener attached (subscription owned by mock)', _sc42Subscribed === true);

// Inject a digit so SC42.f can verify the PIN reset side-effect
_authExports.setCurrentUser({ id: 'sc42-user', email: 's42@test' });
_authExports.pinKeyPress('4');
_authExports.pinKeyPress('2');
tr('SC42.b pre-signOut: user set + pin buffer = "42"', _authExports.getPinBuffer() === '42' && _authExports.getCurrentUser()?.id === 'sc42-user');

// Drive SIGNED_OUT event
_sc42Callback('SIGNED_OUT', null);
tr('SC42.c after SIGNED_OUT: currentUser cleared', _authExports.getCurrentUser() === null);
tr('SC42.d after SIGNED_OUT: currentProfile cleared', _authExports.getCurrentProfile() === null);
eq('SC42.e cleanupRealtimeChannels invoked', _sc42CleanupCalls, 1);
// NOTE: the inline `onAuthStateChange` listener used to reset PIN via
// the inline `_currentUser = null` (no actual PIN buffer reset). The TS
// SIGNED_OUT handler doesn't auto-reset the PIN — that's deliberately
// `logoutLocalState`'s job, not the event handler's. The PIN buffer
// stays — only logoutLocalState() clears it. Verified in SC41 + SC43.
tr('SC42.f buffer preserved across SIGNED_OUT (logoutLocalState owns reset)', _authExports.getPinBuffer() === '42');
_authExports.resetPinBuffer(); // explicit cleanup so SC43 starts clean

// Drive SIGNED_IN via signInUserOrchestrated (the real network path)
const signInResult = await _authExports.signInUserOrchestrated('s42@test', 'pw');
tr('SC42.g signIn returned ok', signInResult.ok === true);
tr('SC42.h currentUser is set after signIn', _authExports.getCurrentUser()?.id === 'sc42-user');
tr('SC42.i currentProfile hydrated via lifecycle hook', _authExports.getCurrentProfile()?.name === 'SC42 Profile');

// Detach + verify clean removal
detachSc42();
tr('SC42.j listener detached cleanly', _sc42Subscribed === false);

// Cleanup
_authExports.setCurrentUser(null);
_authExports.setCurrentProfile(null);
_authExports.setSupabaseClient(null);

// ===========================================================================
// SCENARIO 43 — Concurrent logout guard (TS-11)
// ===========================================================================
// Two simultaneous signOutUserOrchestrated() calls. Contract:
//   - Only ONE Supabase signOut request fires
//   - Only ONE reload fires
//   - _signOutInProgress blocks the second from re-entering the sequence
//   - Both promises resolve when the single sequence completes
// ===========================================================================
console.log('\n=== SCENARIO 43 — concurrent logout guard (TS-11) ===');

let _sc43SignOutCalls = 0;
let _sc43CleanupCalls = 0;
let _sc43ReloadCalls = 0;
const _sc43MockSb = {
  auth: {
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: null }),
    signUp: async () => ({ data: { user: null, session: null }, error: null }),
    signOut: async () => {
      _sc43SignOutCalls += 1;
      // Synthetic delay to simulate the network roundtrip
      await new Promise((r) => setTimeout(r, 10));
      return { error: null };
    },
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
};
_authExports.setSupabaseClient(_sc43MockSb);
_authExports._resetSignOutTracking();
_authExports.registerAuthLifecycleHooks({
  cleanupRealtimeChannels: () => { _sc43CleanupCalls += 1; },
  reload: () => { _sc43ReloadCalls += 1; },
});

// Fire two signOut calls in parallel — second must NOT trigger a second
// signOut request.
const [p1, p2] = [_authExports.signOutUserOrchestrated(), _authExports.signOutUserOrchestrated()];
tr('SC43.a _signOutInProgress is true between fire and resolve', _authExports.isSignOutInProgress() === true);
await Promise.all([p1, p2]);

eq('SC43.b signOut request fired exactly once (guard worked)', _sc43SignOutCalls, 1);
eq('SC43.c cleanupRealtimeChannels invoked exactly once', _sc43CleanupCalls, 1);
eq('SC43.d reload invoked exactly once', _sc43ReloadCalls, 1);
tr('SC43.e _signOutInProgress stays true through reload (set once)', _authExports.isSignOutInProgress() === true);

// Reset guard for SC44
_authExports._resetSignOutTracking();
_authExports.setSupabaseClient(null);

// ===========================================================================
// SCENARIO 44 — Failed auth rollback (TS-11)
// ===========================================================================
// Mock signIn that rejects. Verify:
//   - currentUser stays null (not set provisionally)
//   - currentProfile stays null
//   - signInUserOrchestrated reports ok=false with error message
//   - subsequent successful signIn works normally (state isn't corrupted)
// ===========================================================================
console.log('\n=== SCENARIO 44 — failed auth rollback (TS-11) ===');

// Snapshot prior state (should be null after SC43 cleanup)
const _sc44PreUser = _authExports.getCurrentUser();
const _sc44PreProfile = _authExports.getCurrentProfile();
eq('SC44.a clean slate before attempt', { u: _sc44PreUser, p: _sc44PreProfile }, { u: null, p: null });

// Mock client that returns an error on signInWithPassword
const _sc44MockReject = {
  auth: {
    signInWithPassword: async () => ({ data: null, error: { message: 'Invalid login credentials' } }),
    signUp: async () => ({ data: { user: null, session: null }, error: null }),
    signOut: async () => ({ error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
};
_authExports.setSupabaseClient(_sc44MockReject);

const r1 = await _authExports.signInUserOrchestrated('bad@test', 'wrong');
tr('SC44.b signIn returned ok=false', r1.ok === false);
tr('SC44.c error message propagated', typeof r1.errorMessage === 'string' && r1.errorMessage.includes('Invalid'));
tr('SC44.d currentUser stays null after reject (no provisional set)', _authExports.getCurrentUser() === null);
tr('SC44.e currentProfile stays null after reject', _authExports.getCurrentProfile() === null);

// Failed mid-flow — mock signIn succeeds, profile hydration throws
const _sc44MockMidFail = {
  auth: {
    signInWithPassword: async () => ({ data: { user: { id: 'mid-fail', email: 'mid@test' }, session: null }, error: null }),
    signUp: async () => ({ data: { user: null, session: null }, error: null }),
    signOut: async () => ({ error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
};
_authExports.setSupabaseClient(_sc44MockMidFail);
_authExports.registerAuthLifecycleHooks({
  loadProfile: async () => { throw new Error('Profile hydration failed'); },
});

const r2 = await _authExports.signInUserOrchestrated('mid@test', 'pw');
tr('SC44.f signIn returned ok=false after mid-flow throw', r2.ok === false);
tr('SC44.g currentUser rolled back to null (rollback contract)', _authExports.getCurrentUser() === null);
tr('SC44.h currentProfile rolled back to null', _authExports.getCurrentProfile() === null);

// Verify state isn't corrupted — a CORRECT signIn after failures works
_authExports.registerAuthLifecycleHooks({
  loadProfile: async () => ({ name: 'Recovered', role: 'Autre' }),
  postAuthFlow: async () => {},
});
const _sc44MockOk = {
  auth: {
    signInWithPassword: async () => ({ data: { user: { id: 'recovered', email: 'ok@test' }, session: null }, error: null }),
    signUp: async () => ({ data: { user: null, session: null }, error: null }),
    signOut: async () => ({ error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
};
_authExports.setSupabaseClient(_sc44MockOk);

const r3 = await _authExports.signInUserOrchestrated('ok@test', 'pw');
tr('SC44.i subsequent signIn succeeds (no state corruption)', r3.ok === true);
tr('SC44.j currentUser is set to recovered user', _authExports.getCurrentUser()?.id === 'recovered');

// Cleanup
_authExports.setCurrentUser(null);
_authExports.setCurrentProfile(null);
_authExports.setSupabaseClient(null);

// ===========================================================================
// TS-12 — DATA LAYER + RENDER DISPATCH SCENARIOS (SC45..SC48)
// ===========================================================================
// Bundle the data + render modules via esbuild so the harness exercises
// the SAME implementations the production bundle uses.

const dataBundle = esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', '..', 'src', 'data', 'index.ts')],
  bundle: true, format: 'cjs', platform: 'node', target: 'es2020',
  write: false, logLevel: 'silent',
});
const _dataMod = { exports: {} };
(function (module, exports, require) { eval(dataBundle.outputFiles[0].text); })(_dataMod, _dataMod.exports, require);
const _data = _dataMod.exports;

const renderBundle = esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', '..', 'src', 'render', 'index.ts')],
  bundle: true, format: 'cjs', platform: 'node', target: 'es2020',
  write: false, logLevel: 'silent',
});
const _renderMod = { exports: {} };
(function (module, exports, require) { eval(renderBundle.outputFiles[0].text); })(_renderMod, _renderMod.exports, require);
const _render = _renderMod.exports;

// ===========================================================================
// SCENARIO 45 — Merge preservation (TS-12)
// ===========================================================================
// A partial patch must NOT destroy collections it doesn't touch.
//   - patch on `events` leaves `todos` intact
//   - patch on a scalar leaves all arrays intact
//   - id-array merge keeps both sides' items (by id, last-write wins on collision)
//   - undefined in patch is IGNORED (target unchanged)
//   - null in patch IS RESPECTED (target becomes null)
// ===========================================================================
console.log('\n=== SCENARIO 45 — merge preservation (TS-12) ===');

const initialState = {
  events: [{ id: 'e1', title: 'Event 1' }, { id: 'e2', title: 'Event 2' }],
  todos:  [{ id: 't1', text: 'Todo 1' }],
  tracks: [{ id: 'tr1', name: 'Track 1' }],
  user:   { name: 'Alice', role: 'Artiste' },
};

// Patch only `events` — todos and tracks must be untouched.
const patched1 = _data.patchWorkspace(initialState, {
  events: [{ id: 'e3', title: 'Event 3' }],
});
eq('SC45.a events merged by id (existing + new)', patched1.events.map(e => e.id).sort(), ['e1', 'e2', 'e3']);
eq('SC45.b todos preserved unchanged', patched1.todos, [{ id: 't1', text: 'Todo 1' }]);
eq('SC45.c tracks preserved unchanged', patched1.tracks, [{ id: 'tr1', name: 'Track 1' }]);
eq('SC45.d user preserved unchanged', patched1.user, { name: 'Alice', role: 'Artiste' });

// id-array conflict: same id in both → patch value wins (last write).
const patched2 = _data.patchWorkspace(initialState, {
  events: [{ id: 'e1', title: 'Event 1 — UPDATED' }],
});
const e1After = patched2.events.find(e => e.id === 'e1');
tr('SC45.e id collision: patch value wins', e1After.title === 'Event 1 — UPDATED');
eq('SC45.f id collision: other items preserved', patched2.events.map(e => e.id).sort(), ['e1', 'e2']);

// undefined skipped (RULE 5)
const patched3 = _data.patchWorkspace(initialState, { user: undefined });
eq('SC45.g undefined in patch is ignored', patched3.user, initialState.user);

// null respected (RULE 6)
const patched4 = _data.patchWorkspace(initialState, { user: null });
eq('SC45.h null in patch IS respected (delete intention)', patched4.user, null);

// Nested object merge
const stateNested = { user: { name: 'Alice', role: 'Artiste', extra: 'keep me' } };
const patched5 = _data.patchWorkspace(stateNested, { user: { role: 'Manager' } });
eq('SC45.i nested object merge preserves siblings', patched5.user, { name: 'Alice', role: 'Manager', extra: 'keep me' });

// Original state NOT mutated (immutable update)
eq('SC45.j original state not mutated', initialState.events.length, 2);
eq('SC45.k patched is a new object', patched1 === initialState, false);

// ===========================================================================
// SCENARIO 46 — Render dispatch stability (TS-12)
// ===========================================================================
// 100 invalidateSection() calls must collapse to ONE renderAll pass under
// the rAF batching layer.
// ===========================================================================
console.log('\n=== SCENARIO 46 — render dispatch stability (TS-12) ===');

_render._resetSectionRegistry();
_render._resetRenderPassCount();

let _sc46DashboardCalls = 0;
let _sc46TodosCalls = 0;
let _sc46CalendarCalls = 0;
_render.registerSectionRenderer('dashboard', () => { _sc46DashboardCalls += 1; });
_render.registerSectionRenderer('todos',     () => { _sc46TodosCalls += 1; });
_render.registerSectionRenderer('calendar',  () => { _sc46CalendarCalls += 1; });

// 100 invalidate calls — same section
for (let i = 0; i < 100; i++) _render.invalidateSection('dashboard');
eq('SC46.a no render fired yet (queued)', _render._getRenderPassCount(), 0);
_render._flushRenderQueue();
eq('SC46.b 100 invalidate → 1 render pass', _render._getRenderPassCount(), 1);
eq('SC46.c dashboard renderer fired exactly once', _sc46DashboardCalls, 1);

// 100 invalidate calls — mixed sections
_render._resetRenderPassCount();
_sc46DashboardCalls = 0;
_sc46TodosCalls = 0;
_sc46CalendarCalls = 0;
for (let i = 0; i < 100; i++) {
  _render.invalidateSection(i % 3 === 0 ? 'dashboard' : i % 3 === 1 ? 'todos' : 'calendar');
}
_render._flushRenderQueue();
eq('SC46.d mixed invalidate → 1 render pass', _render._getRenderPassCount(), 1);
eq('SC46.e each section rendered exactly once', { d: _sc46DashboardCalls, t: _sc46TodosCalls, c: _sc46CalendarCalls }, { d: 1, t: 1, c: 1 });

// Full-pass promotion: invalidate + scheduleRender (no args) → full
_render._resetRenderPassCount();
_sc46DashboardCalls = 0;
_sc46TodosCalls = 0;
_sc46CalendarCalls = 0;
_render.invalidateSection('dashboard');
_render.scheduleRender(); // full
_render._flushRenderQueue();
eq('SC46.f full-pass promotion: all sections rendered', { d: _sc46DashboardCalls, t: _sc46TodosCalls, c: _sc46CalendarCalls }, { d: 1, t: 1, c: 1 });

// ===========================================================================
// SCENARIO 47 — Workspace rollback (TS-12)
// ===========================================================================
// Save fails → in-memory state stays consistent (no half-mutation, no
// silent corruption). The state mutation happens BEFORE save() in the
// production flow; save itself is read-only against state.
// ===========================================================================
console.log('\n=== SCENARIO 47 — workspace rollback (TS-12) ===');

// Setup: clean state, register a controllable cloud-push hook.
_data.setWorkspaceDefaults({ events: [] });
_data.setState({ events: [{ id: 'e1', title: 'Original' }] });
let _sc47CloudCalls = 0;
_data.registerCloudPushHook(() => { _sc47CloudCalls += 1; });

// Capture saves through the test hook.
let _sc47SuccessCalls = 0;
_data._setOnSaveSuccess(() => { _sc47SuccessCalls += 1; });

// Healthy save: works as expected.
_data.saveWorkspace({ immediate: true });
eq('SC47.a healthy save: cloud hook fired', _sc47CloudCalls, 1);
eq('SC47.b healthy save: success hook fired', _sc47SuccessCalls, 1);
eq('SC47.c state intact', _data.getState().events.length, 1);

// Now make localStorage throw on setItem
resetStorageMock('setItem-throws');
_data.saveWorkspace({ immediate: true });
// Cloud hook fires synchronously REGARDLESS (matches inline behavior —
// cloud-sync indicator should still reflect the attempt). Success hook
// must NOT fire because persistStateToLocal returned false.
eq('SC47.d failed save: cloud hook still fired (matches inline)', _sc47CloudCalls, 2);
eq('SC47.e failed save: success hook NOT fired', _sc47SuccessCalls, 1);
// State must NOT be corrupted — saveWorkspace never mutates state.
eq('SC47.f state unchanged after failed save', _data.getState().events, [{ id: 'e1', title: 'Original' }]);

// Restore healthy storage; state is still good; next save works.
resetStorageMock('ok');
_data.saveWorkspace({ immediate: true });
eq('SC47.g recovery: save works after storage healed', _sc47SuccessCalls, 2);

// Cleanup
_data.registerCloudPushHook(null);
_data._setOnSaveSuccess(null);

// ===========================================================================
// SCENARIO 48 — Concurrent patch ordering (TS-12)
// ===========================================================================
// Two patchState calls in flight at once. Contract:
//   - Last write wins (the later-queued patch shows in final state)
//   - No half-merged intermediate visible: each patch sees a consistent
//     pre-patch snapshot
//   - The id-array merge rules are applied per-patch (not per-batch)
// ===========================================================================
console.log('\n=== SCENARIO 48 — concurrent patch ordering (TS-12) ===');

_data.setState({ events: [{ id: 'e0', title: 'Initial' }], counter: 0 });

// Fire two patches synchronously — they queue through a Promise chain.
const _sc48p1 = _data.patchState({ events: [{ id: 'e1', title: 'Patch 1' }], counter: 1 });
const _sc48p2 = _data.patchState({ events: [{ id: 'e2', title: 'Patch 2' }], counter: 2 });

const [_sc48r1, _sc48r2] = await Promise.all([_sc48p1, _sc48p2]);
// Each patch returns the state SNAPSHOT it produced; the patches are
// serialized so r1 reflects the state after patch 1, r2 after patch 2.
eq('SC48.a patch 1 saw the initial state + added e1', _sc48r1.events.map(e => e.id).sort(), ['e0', 'e1']);
eq('SC48.b patch 2 saw state-after-patch-1 + added e2', _sc48r2.events.map(e => e.id).sort(), ['e0', 'e1', 'e2']);
eq('SC48.c counter reflects last-write-wins', _sc48r2.counter, 2);

const finalState = _data.getState();
eq('SC48.d final state matches last patch return value', finalState.counter, 2);
eq('SC48.e all 3 events present (no corruption)', finalState.events.map(e => e.id).sort(), ['e0', 'e1', 'e2']);

// Stress: 10 concurrent patches
_data.setState({ counter: 0, events: [] });
const _sc48Promises = [];
for (let i = 1; i <= 10; i++) {
  _sc48Promises.push(_data.patchState({ counter: i, events: [{ id: 'e' + i, title: 'E' + i }] }));
}
const _sc48Results = await Promise.all(_sc48Promises);
const _sc48Last = _sc48Results[_sc48Results.length - 1];
eq('SC48.f 10 concurrent patches: last counter wins', _sc48Last.counter, 10);
eq('SC48.g 10 concurrent patches: all events accumulated', _sc48Last.events.length, 10);

// ===========================================================================
// TS-13C — CALENDAR RENDER SCENARIOS (SC49..SC53)
// ===========================================================================
// Bundle the calendar render module via esbuild. The bundled exports
// include pure calculators + the composers + the ghost utilities.
const calBundle = esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', '..', 'src', 'render', 'calendar', 'index.ts')],
  bundle: true, format: 'cjs', platform: 'node', target: 'es2020',
  write: false, logLevel: 'silent',
});
const _calMod = { exports: {} };
(function (module, exports, require) { eval(calBundle.outputFiles[0].text); })(_calMod, _calMod.exports, require);
const _cal = _calMod.exports;

// Minimal deps stub for chip composers — none of SC49-53 actually inspects
// chip HTML content, only counts + structure. We still pass a complete
// deps object so the composers don't crash on missing methods.
const _calDepsStub = {
  eventTooltip: () => '',
  tagChipsHTML: () => '',
  entityMatchesTagFilter: () => true,
  filterVisibleEvents: (evs) => evs,
  eventActorAvatarHTML: () => '',
};

// ===========================================================================
// SCENARIO 49 — Overlap stability (TS-13C)
// ===========================================================================
// 50 events with overlapping time windows → lane assignment must be
// deterministic + every lane is internally non-overlapping.
// ===========================================================================
console.log('\n=== SCENARIO 49 — overlap stability (TS-13C) ===');

function _makeSC49Events(n) {
  // Build events that overlap aggressively: each event starts a few
  // minutes after the previous and lasts an hour. Result: a dense block
  // of overlapping pills on the same day.
  const out = [];
  for (let i = 0; i < n; i++) {
    const h = 8 + Math.floor(i / 4);          // hours 8..21
    const m = (i % 4) * 15;                    // 0, 15, 30, 45
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    out.push({
      id: 'e' + String(i).padStart(3, '0'),
      title: 'E' + i,
      date: '2026-05-20',
      time: hh + ':' + mm,
      duration: 60,
    });
  }
  return out;
}

const _sc49Events = _makeSC49Events(50);

// First run — capture the lane assignment.
const _sc49Lanes1 = _cal.assignLanes(_sc49Events);
// Second run — must be IDENTICAL (SC49 is the determinism contract).
const _sc49Lanes2 = _cal.assignLanes(_sc49Events);

// Convert to comparable plain object (Map → sorted entries array).
function _laneSig(lanes) {
  return Array.from(lanes.entries()).sort((a, b) => a[0] < b[0] ? -1 : 1);
}

eq('SC49.a lane assignment is deterministic across calls', _laneSig(_sc49Lanes1), _laneSig(_sc49Lanes2));

// Per-lane invariant: events sharing a lane must NOT overlap.
const _sc49ByLane = new Map();
for (const e of _sc49Events) {
  const lane = _sc49Lanes1.get(e.id);
  if (!_sc49ByLane.has(lane)) _sc49ByLane.set(lane, []);
  _sc49ByLane.get(lane).push(e);
}
let _sc49AnyOverlap = false;
for (const evs of _sc49ByLane.values()) {
  for (let i = 0; i < evs.length; i++) {
    for (let j = i + 1; j < evs.length; j++) {
      if (_cal.eventsOverlap(evs[i], evs[j])) { _sc49AnyOverlap = true; break; }
    }
    if (_sc49AnyOverlap) break;
  }
  if (_sc49AnyOverlap) break;
}
tr('SC49.b no two events in the same lane overlap', !_sc49AnyOverlap);

// Lane count grows with overlap density but stays bounded.
const _sc49LaneCount = _cal.laneCount(_sc49Lanes1);
tr('SC49.c lane count > 0 (at least one lane allocated)', _sc49LaneCount > 0);
tr('SC49.d lane count ≤ event count (no empty allocations)', _sc49LaneCount <= 50);

// 50 events should compress into around 4 lanes (4-events-per-hour pattern).
tr('SC49.e lane count compresses overlapping events (~4 lanes for the pattern)', _sc49LaneCount <= 8);

// ===========================================================================
// SCENARIO 50 — Drag preview cleanup (TS-13C)
// ===========================================================================
// Create a ghost, then sweep. The DOM must contain zero ghost elements
// AND no .cal-event-dragging / .cal-cell-droptarget flags remain.
// ===========================================================================
console.log('\n=== SCENARIO 50 — drag preview cleanup (TS-13C) ===');

// Extend the mock document just enough to support the sweep contract.
// We need: querySelectorAll('.cal-event-ghost' | '.cal-event-dragging' |
// '.cal-cell-droptarget') AND a body.appendChild + remove flow.
const _sc50Ghosts = [];
const _sc50DraggingPills = [{ classList: { remove: () => { _sc50DraggingFlag = false; } } }];
const _sc50DropTargets = [{ classList: { remove: () => { _sc50DropTargetFlag = false; } } }];
let _sc50DraggingFlag = true;
let _sc50DropTargetFlag = true;

// Swap document.querySelectorAll for SC50 only.
const _origQsa = document.querySelectorAll;
document.querySelectorAll = function (sel) {
  if (sel === '.cal-event-ghost') return _sc50Ghosts.slice();
  if (sel === '.cal-event-dragging') return _sc50DraggingPills.slice();
  if (sel === '.cal-cell-droptarget') return _sc50DropTargets.slice();
  return [];
};

// Seed 3 ghost elements with a remove() method.
for (let i = 0; i < 3; i++) {
  _sc50Ghosts.push({ remove: () => { _sc50Ghosts.splice(_sc50Ghosts.indexOf(this), 1); } });
}
// Capture pre-sweep count.
const _sc50Before = _sc50Ghosts.length;

// Sweep — overwrite the splice with a clearing one for clean assertion.
_sc50Ghosts.forEach((g) => { g.remove = () => { /* observed by sweep, no-op DOM */ }; });
// Reset to a fresh ghosts list whose .remove() empties the list.
let _sc50Cleared = false;
const _sc50LiveGhosts = [
  { remove: function () { _sc50Cleared = true; } },
];
document.querySelectorAll = function (sel) {
  if (sel === '.cal-event-ghost') return _sc50LiveGhosts;
  if (sel === '.cal-event-dragging') return _sc50DraggingPills;
  if (sel === '.cal-cell-droptarget') return _sc50DropTargets;
  return [];
};

_cal.sweepDragGhosts();
tr('SC50.a ghost remove() called during sweep', _sc50Cleared === true);
tr('SC50.b cal-event-dragging class cleared', _sc50DraggingFlag === false);
tr('SC50.c cal-cell-droptarget class cleared', _sc50DropTargetFlag === false);

// Restore the original querySelectorAll for subsequent scenarios.
document.querySelectorAll = _origQsa;

eq('SC50.d pre-sweep ghost count was correct (sanity)', _sc50Before, 3);

// ===========================================================================
// SCENARIO 51 — Repeated rerender idempotence (TS-13C)
// ===========================================================================
// Build 100 week views with identical inputs — the HTML output must be
// byte-identical every time. (Same property for month view.)
// ===========================================================================
console.log('\n=== SCENARIO 51 — repeated rerender idempotence (TS-13C) ===');

const _sc51Events = [
  { id: 'a', title: 'Alpha', date: '2026-05-18', time: '09:00', duration: 60 },
  { id: 'b', title: 'Beta',  date: '2026-05-19', time: '14:30', duration: 90 },
  { id: 'c', title: 'Gamma', date: '2026-05-20', duration: 60 }, // all-day
];
const _sc51WeekOpts = { startHour: 7, endHour: 23, hourHeight: 56, todayIso: '2026-05-18' };

const _sc51Week1 = _cal.buildWeekView('2026-05-18', _sc51Events, _calDepsStub, _sc51WeekOpts);
let _sc51AllSame = true;
let _sc51FirstHash = _sc51Week1.html.length;
for (let i = 0; i < 100; i++) {
  const r = _cal.buildWeekView('2026-05-18', _sc51Events, _calDepsStub, _sc51WeekOpts);
  if (r.html !== _sc51Week1.html) { _sc51AllSame = false; break; }
  if (r.html.length !== _sc51FirstHash) { _sc51AllSame = false; break; }
}
tr('SC51.a 100 week renders → byte-identical HTML', _sc51AllSame);

// Same property for month view.
const _sc51Month1 = _cal.buildMonthView('2026-05', _sc51Events, _calDepsStub, { todayIso: '2026-05-18' });
let _sc51MonthSame = true;
for (let i = 0; i < 100; i++) {
  const r = _cal.buildMonthView('2026-05', _sc51Events, _calDepsStub, { todayIso: '2026-05-18' });
  if (r.html !== _sc51Month1.html) { _sc51MonthSame = false; break; }
}
tr('SC51.b 100 month renders → byte-identical HTML', _sc51MonthSame);

// Node count proxy: count '<div' substrings. Must be stable.
const _sc51NodeCount = (_sc51Week1.html.match(/<div/g) || []).length;
const _sc51NodeCount2 = (_cal.buildWeekView('2026-05-18', _sc51Events, _calDepsStub, _sc51WeekOpts).html.match(/<div/g) || []).length;
eq('SC51.c node count stable across rerenders', _sc51NodeCount, _sc51NodeCount2);

// ===========================================================================
// SCENARIO 52 — Event ordering determinism (TS-13C)
// ===========================================================================
// Same input set in DIFFERENT orders → same final HTML. The renderers
// must sort their inputs internally.
// ===========================================================================
console.log('\n=== SCENARIO 52 — event ordering determinism (TS-13C) ===');

const _sc52Forward = [
  { id: 'a', title: 'A', date: '2026-05-18', time: '09:00', duration: 60 },
  { id: 'b', title: 'B', date: '2026-05-18', time: '10:00', duration: 60 },
  { id: 'c', title: 'C', date: '2026-05-18', time: '11:00', duration: 60 },
];
const _sc52Reversed = _sc52Forward.slice().reverse();
const _sc52Shuffled = [_sc52Forward[2], _sc52Forward[0], _sc52Forward[1]];

const _sc52MonthOpts = { todayIso: '2026-05-18' };
const _sc52F = _cal.buildMonthView('2026-05', _sc52Forward, _calDepsStub, _sc52MonthOpts).html;
const _sc52R = _cal.buildMonthView('2026-05', _sc52Reversed, _calDepsStub, _sc52MonthOpts).html;
const _sc52S = _cal.buildMonthView('2026-05', _sc52Shuffled, _calDepsStub, _sc52MonthOpts).html;
tr('SC52.a month: reversed input → identical HTML (sort by time)', _sc52F === _sc52R);
tr('SC52.b month: shuffled input → identical HTML', _sc52F === _sc52S);

// Lane assignment also deterministic on permutations (already in SC49,
// reinforced here with a permuted input).
const _sc52LanesF = _cal.assignLanes(_sc52Forward);
const _sc52LanesR = _cal.assignLanes(_sc52Reversed);
eq('SC52.c lanes: same assignment regardless of input order', _laneSig(_sc52LanesF), _laneSig(_sc52LanesR));

// ===========================================================================
// SCENARIO 53 — Resize interruption rollback (TS-13C)
// ===========================================================================
// The resize flow lives in inline handlers (still protected by SC1-9 +
// SC25-32). TS-13C verifies the calculations layer's contract: an event
// whose duration is mid-mutation must not corrupt the conflict detection
// or the expansion functions. We simulate by mutating an event mid-stream.
// ===========================================================================
console.log('\n=== SCENARIO 53 — resize interruption rollback (TS-13C) ===');

const _sc53Original = { id: 'r1', title: 'Resize me', date: '2026-05-18', time: '10:00', duration: 60 };
const _sc53Other = { id: 'r2', title: 'Other', date: '2026-05-18', time: '10:30', duration: 30 };
const _sc53Events = [_sc53Original, _sc53Other];

// Pre-resize: r1 (10:00-11:00) overlaps r2 (10:30-11:00).
const _sc53PreConflicts = _cal.detectEventConflicts(_sc53Events);
tr('SC53.a pre-resize: conflict detected', _sc53PreConflicts.size === 2);

// Simulate aborted resize: original event's duration was about to become
// 30 but the user cancelled. State should NOT have been mutated by the
// calculations layer.
tr('SC53.b original event duration not mutated by detectEventConflicts', _sc53Original.duration === 60);
tr('SC53.c original event time not mutated', _sc53Original.time === '10:00');

// expandEventsForWindow does NOT mutate its inputs either.
const _sc53BeforeKeys = JSON.stringify(_sc53Events);
_cal.expandEventsForWindow(_sc53Events, '2026-05-18', '2026-05-18');
tr('SC53.d expandEventsForWindow does not mutate input', JSON.stringify(_sc53Events) === _sc53BeforeKeys);

// If we DID resize to 30 (cancelled later → rollback to 60), the conflicts
// should reflect the CURRENT state. Mutate, recompute, restore, recompute.
_sc53Original.duration = 30;
// 10:00-10:30 and 10:30-11:00 are back-to-back, NOT overlapping.
const _sc53MidConflicts = _cal.detectEventConflicts(_sc53Events);
tr('SC53.e mid-resize: conflict resolves correctly (no overlap)', _sc53MidConflicts.size === 0);

// Rollback simulation
_sc53Original.duration = 60;
const _sc53AfterConflicts = _cal.detectEventConflicts(_sc53Events);
tr('SC53.f after rollback: conflict re-appears', _sc53AfterConflicts.size === 2);
tr('SC53.g state recovered: duration === 60', _sc53Original.duration === 60);

// ===========================================================================
// TS-14A — DASHBOARD RENDER SCENARIOS (SC54..SC58)
// ===========================================================================
const dashBundle = esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', '..', 'src', 'render', 'dashboard', 'index.ts')],
  bundle: true, format: 'cjs', platform: 'node', target: 'es2020',
  write: false, logLevel: 'silent',
});
const _dashMod = { exports: {} };
(function (module, exports, require) { eval(dashBundle.outputFiles[0].text); })(_dashMod, _dashMod.exports, require);
const _dash = _dashMod.exports;

const _dashDepsStub = {
  filterVisibleEvents: (events) => events,
  isTodoOnDashboard: () => true,
  todoPriority: (t) => (t && (t.priority || (t.urgent ? 'urgent' : 'normal'))) || 'normal',
  formatDate: (s) => s || '',
  formatEventTime: (s) => (s ? s.slice(0, 5) : ''),
  typeLabel: (t) => t || '',
  escapeHtml: (s) => String(s == null ? '' : s),
  icon: () => '',
  emptyState: (kind, title) => `<div class="empty">${title}</div>`,
  isFutureOrToday: (s) => !!s && s >= '2026-05-20',
  parseDate: (s) => s ? new Date(s) : null,
};

const _dashModel = {
  events: [
    { id: 'e1', title: 'Studio', date: '2026-05-21', time: '10:00', type: 'studio' },
    { id: 'e2', title: 'Release X', date: '2026-06-01', time: '12:00', type: 'release' },
    { id: 'e3', title: 'Old', date: '2026-05-10', time: '14:00', type: 'meeting' },
  ],
  todos: [
    { id: 't1', text: 'Task 1', priority: 'critique', done: false },
    { id: 't2', text: 'Task 2', priority: 'urgent', done: false },
    { id: 't3', text: 'Task 3', priority: 'normal', done: false },
    { id: 't4', text: 'Done',   priority: 'critique', done: true },
  ],
  profile: { name: 'Alice', alias: 'A.', role: 'Artiste' },
  user: { id: 'u1', email: 'a@test' },
  roleKey: 'artiste',
  today: new Date('2026-05-20T12:00:00'),
  projectDate: new Date('2026-09-11'),
  phases: [{ label: 'P0', title: 'Phase 0' }, { label: 'P1', title: 'Phase 1' }],
  phaseIdx: 0,
  phase: { label: 'P0', title: 'Phase 0' },
  role: { key: 'artiste', label: 'Artiste' },
};

// ===========================================================================
// SCENARIO 54 — Dashboard rerender idempotence (TS-14A)
// ===========================================================================
console.log('\n=== SCENARIO 54 — dashboard rerender idempotence (TS-14A) ===');
const _sc54First = _dash.buildDashboardView(_dashModel, _dashDepsStub);
let _sc54AllSame = true;
for (let i = 0; i < 100; i++) {
  const r = _dash.buildDashboardView(_dashModel, _dashDepsStub);
  if (JSON.stringify(r) !== JSON.stringify(_sc54First)) { _sc54AllSame = false; break; }
}
tr('SC54.a 100 dashboard renders → identical structured result', _sc54AllSame);
eq('SC54.b heroCount stable', _sc54First.heroCount, _dash.buildDashboardView(_dashModel, _dashDepsStub).heroCount);
// Count parent <div class="dash-urgent-item" only (the children have suffixed
// class names like dash-urgent-item-text / -meta).
eq('SC54.c urgent count stable (2 items expected)', (_sc54First.urgentHtml.match(/class="dash-urgent-item"/g) || []).length, 2);

// ===========================================================================
// SCENARIO 55 — Widget ordering determinism (TS-14A)
// ===========================================================================
console.log('\n=== SCENARIO 55 — widget ordering determinism (TS-14A) ===');
const _sc55Shuffled = {
  ..._dashModel,
  events: [_dashModel.events[2], _dashModel.events[0], _dashModel.events[1]],
  todos: [_dashModel.todos[3], _dashModel.todos[2], _dashModel.todos[1], _dashModel.todos[0]],
};
const _sc55Result = _dash.buildDashboardView(_sc55Shuffled, _dashDepsStub);
eq('SC55.a shuffled inputs → identical upcomingHtml', _sc54First.upcomingHtml, _sc55Result.upcomingHtml);
eq('SC55.b shuffled inputs → identical todayHtml', _sc54First.todayHtml, _sc55Result.todayHtml);
eq('SC55.c shuffled inputs → identical urgentHtml (priority sort)', _sc54First.urgentHtml, _sc55Result.urgentHtml);

// ===========================================================================
// SCENARIO 56 — Empty-state stability (TS-14A)
// ===========================================================================
console.log('\n=== SCENARIO 56 — empty-state stability (TS-14A) ===');
const _sc56Empty = {
  ..._dashModel,
  events: [],
  todos: [],
};
const _sc56Result = _dash.buildDashboardView(_sc56Empty, _dashDepsStub);
tr('SC56.a empty events → upcoming flagged empty', _sc56Result.upcomingEmpty === true);
tr('SC56.b empty events → upcoming empty-state HTML produced', _sc56Result.upcomingEmptyHtml.length > 0);
tr('SC56.c empty events → today meta says "rien de prévu"', _sc56Result.todayMeta === 'rien de prévu');
tr('SC56.d empty todos → urgent hidden', _sc56Result.urgentHidden === true);
tr('SC56.e empty events → release hidden', _sc56Result.releaseHidden === true);

// 50 reruns on empty inputs — same output every time
let _sc56Stable = true;
for (let i = 0; i < 50; i++) {
  const r = _dash.buildDashboardView(_sc56Empty, _dashDepsStub);
  if (JSON.stringify(r) !== JSON.stringify(_sc56Result)) { _sc56Stable = false; break; }
}
tr('SC56.f empty-state output stable across 50 reruns', _sc56Stable);

// ===========================================================================
// SCENARIO 57 — Partial state patch rollback (TS-14A)
// ===========================================================================
console.log('\n=== SCENARIO 57 — partial state patch rollback (TS-14A) ===');
// Snapshot via JSON to compare against post-render state.
const _sc57Before = JSON.parse(JSON.stringify(_dashModel));
const _sc57Result = _dash.buildDashboardView(_dashModel, _dashDepsStub);
void _sc57Result;
// Composition layer must NOT mutate inputs.
eq('SC57.a model events untouched', _dashModel.events, _sc57Before.events);
eq('SC57.b model todos untouched', _dashModel.todos, _sc57Before.todos);
eq('SC57.c model profile untouched', _dashModel.profile, _sc57Before.profile);

// Simulate a partial patch (only events changes), verify the dashboard
// reflects new events without re-mutating profile/todos.
const _sc57Patched = { ..._dashModel, events: [{ id: 'X', title: 'New', date: '2026-05-22', type: 'studio' }] };
const _sc57R = _dash.buildDashboardView(_sc57Patched, _dashDepsStub);
tr('SC57.d patched events flow through to upcomingHtml', _sc57R.upcomingHtml.includes('New'));
tr('SC57.e patched events do NOT corrupt urgent (separate field)', _sc57R.urgentHtml === _sc54First.urgentHtml);

// Rollback to original — same output as before
const _sc57Rolled = _dash.buildDashboardView(_dashModel, _dashDepsStub);
eq('SC57.f rollback to original model → original output restored', _sc57Rolled.upcomingHtml, _sc54First.upcomingHtml);

// ===========================================================================
// SCENARIO 58 — Mount/unmount cleanup symmetry (TS-14A)
// ===========================================================================
console.log('\n=== SCENARIO 58 — mount/unmount cleanup symmetry (TS-14A) ===');
// The composition layer never touches the DOM, so "mount/unmount" symmetry
// at the TS-14A level reduces to: building a view + discarding it must
// not leak any global state. We assert no module-private accumulator
// grows across rebuilds.
let _sc58HtmlLengthsEvent = [];
for (let i = 0; i < 10; i++) {
  _sc58HtmlLengthsEvent.push(_dash.buildDashboardView(_dashModel, _dashDepsStub).upcomingHtml.length);
}
const _sc58FirstLen = _sc58HtmlLengthsEvent[0];
const _sc58AllSame = _sc58HtmlLengthsEvent.every((n) => n === _sc58FirstLen);
tr('SC58.a 10 rebuilds → constant upcoming HTML length', _sc58AllSame);

// Empty-mount → non-empty-mount → empty-mount cycle returns to identical empty output
const _sc58EmptyA = _dash.buildDashboardView(_sc56Empty, _dashDepsStub);
const _sc58NonEmpty = _dash.buildDashboardView(_dashModel, _dashDepsStub);
const _sc58EmptyB = _dash.buildDashboardView(_sc56Empty, _dashDepsStub);
void _sc58NonEmpty;
eq('SC58.b empty → non-empty → empty: empty outputs match (no drift)', _sc58EmptyA, _sc58EmptyB);

// 50 alternating cycles — final empty state == first empty state
for (let i = 0; i < 50; i++) {
  _dash.buildDashboardView(i % 2 === 0 ? _sc56Empty : _dashModel, _dashDepsStub);
}
const _sc58FinalEmpty = _dash.buildDashboardView(_sc56Empty, _dashDepsStub);
eq('SC58.c 50 alternating cycles → empty output stable', _sc58FinalEmpty, _sc58EmptyA);

// ===========================================================================
// TS-14B — TODOS + INSPIRATIONS RENDER SCENARIOS (SC59..SC66)
// ===========================================================================
const todosBundle = esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', '..', 'src', 'render', 'todos', 'index.ts')],
  bundle: true, format: 'cjs', platform: 'node', target: 'es2020',
  write: false, logLevel: 'silent',
});
const _todosMod = { exports: {} };
(function (module, exports, require) { eval(todosBundle.outputFiles[0].text); })(_todosMod, _todosMod.exports, require);
const _todosR = _todosMod.exports;

const inspiBundle = esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', '..', 'src', 'render', 'inspirations', 'index.ts')],
  bundle: true, format: 'cjs', platform: 'node', target: 'es2020',
  write: false, logLevel: 'silent',
});
const _inspiMod = { exports: {} };
(function (module, exports, require) { eval(inspiBundle.outputFiles[0].text); })(_inspiMod, _inspiMod.exports, require);
const _inspiR = _inspiMod.exports;

const _todoDepsStub = {
  escapeHtml: (s) => String(s == null ? '' : s),
  formatDate: (s) => s || '',
  icon: () => '',
  emptyState: (kind, title) => `<div class="empty">${title}</div>`,
  todoPriority: (t) => (t && (t.priority || (t.urgent ? 'urgent' : 'normal'))) || 'normal',
  tagChipsHTML: () => '',
  entityMatchesTagFilter: () => true,
  categories: ['Pre-Launch', 'Rollout', 'Pivot', 'Élévation', 'Événement', 'Autre'],
};

const _todosFixture = [
  { id: 't1', text: 'Pre-launch task', cat: 'Pre-Launch', done: false, urgent: true, priority: 'urgent' },
  { id: 't2', text: 'Rollout task', cat: 'Rollout', done: false, priority: 'normal' },
  { id: 't3', text: 'Done task', cat: 'Pre-Launch', done: true, priority: 'normal' },
  { id: 't4', text: 'Critical task', cat: 'Pre-Launch', done: false, priority: 'critique', due: '2026-05-15' },
];

// ===========================================================================
// SCENARIO 59 — Todos rerender idempotence (TS-14B)
// ===========================================================================
console.log('\n=== SCENARIO 59 — todos rerender idempotence (TS-14B) ===');
const _sc59Model = { todos: _todosFixture, filter: 'all', sort: 'phase', tagFilter: null };
const _sc59First = _todosR.buildTodosView(_sc59Model, _todoDepsStub);
let _sc59Same = true;
for (let i = 0; i < 100; i++) {
  if (JSON.stringify(_todosR.buildTodosView(_sc59Model, _todoDepsStub)) !== JSON.stringify(_sc59First)) {
    _sc59Same = false; break;
  }
}
tr('SC59.a 100 todos renders → identical result', _sc59Same);
eq('SC59.b progress label correct', _sc59First.progressLabel, '1 / 4');
eq('SC59.c progress percent correct', _sc59First.progressBarPct, 25);
// 4 list-row buttons expected (1 per todo).
eq('SC59.d 4 list rows in output', (_sc59First.listHtml.match(/class="list-row /g) || []).length, 4);

// ===========================================================================
// SCENARIO 60 — Todos ordering + filter stability (TS-14B)
// ===========================================================================
console.log('\n=== SCENARIO 60 — todos ordering + filter stability (TS-14B) ===');
const _sc60Shuffled = { ..._sc59Model, todos: [_todosFixture[3], _todosFixture[0], _todosFixture[2], _todosFixture[1]] };
const _sc60Result = _todosR.buildTodosView(_sc60Shuffled, _todoDepsStub);
eq('SC60.a shuffled todos → identical listHtml (phase grouping sort)', _sc60Result.listHtml, _sc59First.listHtml);

// Filter to 'urgent' — only t1 (urgent + !done) qualifies
const _sc60Urgent = _todosR.buildTodosView({ ..._sc59Model, filter: 'urgent' }, _todoDepsStub);
eq('SC60.b urgent filter → 1 row', (_sc60Urgent.listHtml.match(/class="list-row /g) || []).length, 1);

// Filter to 'done' — only t3
const _sc60Done = _todosR.buildTodosView({ ..._sc59Model, filter: 'done' }, _todoDepsStub);
eq('SC60.c done filter → 1 row', (_sc60Done.listHtml.match(/class="list-row /g) || []).length, 1);
tr('SC60.d done filter → empty=false (1 result)', _sc60Done.empty === false);

// Sort by name — alphabetical order; output stable across shuffled inputs
const _sc60NameA = _todosR.buildTodosView({ ..._sc59Model, sort: 'name' }, _todoDepsStub);
const _sc60NameB = _todosR.buildTodosView({ ..._sc60Shuffled, sort: 'name' }, _todoDepsStub);
eq('SC60.e name sort → identical regardless of input order', _sc60NameA.listHtml, _sc60NameB.listHtml);

// ===========================================================================
// SCENARIO 61 — Todos empty-state stability (TS-14B)
// ===========================================================================
console.log('\n=== SCENARIO 61 — todos empty-state stability (TS-14B) ===');
const _sc61Empty = _todosR.buildTodosView({ todos: [], filter: 'all', sort: 'phase', tagFilter: null }, _todoDepsStub);
tr('SC61.a empty todos → empty=true', _sc61Empty.empty === true);
eq('SC61.b empty todos → progress "0 / 0"', _sc61Empty.progressLabel, '0 / 0');
eq('SC61.c empty todos → 0 %', _sc61Empty.progressBarPct, 0);
let _sc61Stable = true;
for (let i = 0; i < 50; i++) {
  if (JSON.stringify(_todosR.buildTodosView({ todos: [], filter: 'all', sort: 'phase', tagFilter: null }, _todoDepsStub)) !== JSON.stringify(_sc61Empty)) {
    _sc61Stable = false; break;
  }
}
tr('SC61.d 50 reruns on empty → stable', _sc61Stable);

// ===========================================================================
// SCENARIO 62 — Todos input mutation rollback (TS-14B)
// ===========================================================================
console.log('\n=== SCENARIO 62 — todos input mutation rollback (TS-14B) ===');
const _sc62Snapshot = JSON.stringify(_todosFixture);
for (let i = 0; i < 10; i++) {
  _todosR.buildTodosView(_sc59Model, _todoDepsStub);
}
eq('SC62.a 10 renders did NOT mutate the input array', JSON.stringify(_todosFixture), _sc62Snapshot);

// Pure helpers don't mutate either
const _sc62Sorted = _todosR.applySort(_todosFixture, 'name');
tr('SC62.b applySort returns a NEW array', _sc62Sorted !== _todosFixture);
eq('SC62.c applySort does NOT mutate the input', JSON.stringify(_todosFixture), _sc62Snapshot);

// ===========================================================================
// INSPIRATIONS scenarios — SC63..SC66
// ===========================================================================
const _inspiDepsStub = {
  escapeHtml: (s) => String(s == null ? '' : s),
  icon: () => '',
  emptyState: (kind, title) => `<div class="empty">${title}</div>`,
  parseMedia: (url) => ({ mediaType: 'link', mediaUrl: url, mediaEmbed: '', provider: '' }),
  categories: ['Audio', 'Visuel', 'Mood', 'Autre'],
};

const _inspiFixture = [
  { id: 'i1', title: 'First', category: 'Mood', addedAt: '2026-05-01T10:00', mediaType: 'image', mediaUrl: 'http://x/1.png' },
  { id: 'i2', title: 'Second', category: 'Visuel', addedAt: '2026-05-15T12:00', mediaType: 'note' },
  { id: 'i3', title: 'Third', category: 'Mood', addedAt: '2026-05-10T08:00', mediaType: 'link', mediaUrl: 'http://example.com' },
];

// ===========================================================================
// SCENARIO 63 — Inspirations rerender idempotence (TS-14B)
// ===========================================================================
console.log('\n=== SCENARIO 63 — inspirations rerender idempotence (TS-14B) ===');
const _sc63Model = { list: _inspiFixture, filter: 'all' };
const _sc63First = _inspiR.buildInspirationsView(_sc63Model, _inspiDepsStub);
let _sc63Same = true;
for (let i = 0; i < 100; i++) {
  if (JSON.stringify(_inspiR.buildInspirationsView(_sc63Model, _inspiDepsStub)) !== JSON.stringify(_sc63First)) {
    _sc63Same = false; break;
  }
}
tr('SC63.a 100 inspi renders → identical', _sc63Same);
eq('SC63.b 3 cards in output', (_sc63First.gridHtml.match(/<article class="inspi-card-v2"/g) || []).length, 3);

// ===========================================================================
// SCENARIO 64 — Inspirations ordering determinism (newest first)
// ===========================================================================
console.log('\n=== SCENARIO 64 — inspirations ordering determinism (TS-14B) ===');
const _sc64Shuffled = { list: [_inspiFixture[2], _inspiFixture[0], _inspiFixture[1]], filter: 'all' };
const _sc64Result = _inspiR.buildInspirationsView(_sc64Shuffled, _inspiDepsStub);
eq('SC64.a shuffled inputs → identical gridHtml (sort by addedAt desc)', _sc64Result.gridHtml, _sc63First.gridHtml);
// First card should be i2 (latest addedAt).
const _sc64FirstCardId = (_sc63First.gridHtml.match(/data-id="([^"]+)"/) || [])[1];
eq('SC64.b first card is the newest (i2)', _sc64FirstCardId, 'i2');

// Filter to 'Mood' — only i1 + i3
const _sc64Mood = _inspiR.buildInspirationsView({ ..._sc63Model, filter: 'Mood' }, _inspiDepsStub);
eq('SC64.c Mood filter → 2 cards', (_sc64Mood.gridHtml.match(/<article class="inspi-card-v2"/g) || []).length, 2);

// ===========================================================================
// SCENARIO 65 — Inspirations empty-state stability (TS-14B)
// ===========================================================================
console.log('\n=== SCENARIO 65 — inspirations empty-state stability (TS-14B) ===');
const _sc65Empty = _inspiR.buildInspirationsView({ list: [], filter: 'all' }, _inspiDepsStub);
tr('SC65.a empty list → empty=true', _sc65Empty.empty === true);
eq('SC65.b empty list → gridHtml empty', _sc65Empty.gridHtml, '');
let _sc65Stable = true;
for (let i = 0; i < 50; i++) {
  if (JSON.stringify(_inspiR.buildInspirationsView({ list: [], filter: 'all' }, _inspiDepsStub)) !== JSON.stringify(_sc65Empty)) {
    _sc65Stable = false; break;
  }
}
tr('SC65.c 50 reruns on empty → stable', _sc65Stable);

// ===========================================================================
// SCENARIO 66 — Inspirations input mutation rollback (TS-14B)
// ===========================================================================
console.log('\n=== SCENARIO 66 — inspirations input mutation rollback (TS-14B) ===');
const _sc66Snapshot = JSON.stringify(_inspiFixture);
for (let i = 0; i < 10; i++) {
  _inspiR.buildInspirationsView(_sc63Model, _inspiDepsStub);
}
eq('SC66.a 10 renders did NOT mutate input', JSON.stringify(_inspiFixture), _sc66Snapshot);

// normalizeInspi doesn't mutate either
const _sc66NormA = _inspiR.normalizeInspi(_inspiFixture[0], _inspiDepsStub);
const _sc66NormB = _inspiR.normalizeInspi(_inspiFixture[0], _inspiDepsStub);
eq('SC66.b normalizeInspi is deterministic', _sc66NormA, _sc66NormB);
eq('SC66.c normalizeInspi does NOT mutate input', JSON.stringify(_inspiFixture[0]), JSON.stringify({ id: 'i1', title: 'First', category: 'Mood', addedAt: '2026-05-01T10:00', mediaType: 'image', mediaUrl: 'http://x/1.png' }));

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log('\n=== SUMMARY ===');
console.log('Pass: ' + pass + '\nFail: ' + fail);
console.log('Total dispatch ops (add/remove) logged: ' + dispatchLog.length);
process.exit(fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error('TS-11 async block threw:', err);
  process.exit(2);
});
