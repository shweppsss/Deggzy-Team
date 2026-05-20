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

// 0.20 — physical keyboard PIN handler at L10664. The offsetParent gate
// is documented as a critical fix (the previous wrong check was
// swallowing Backspace globally). Pinning it as an invariant prevents
// the bug from returning if the check is reverted.
function extractPinKeyboardHandlerAsNamedFn() {
  const marker = '// Physical keyboard support — only while the PIN view';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error('PIN keyboard handler marker not found');
  const after = html.slice(start);
  const end = after.indexOf('\n});\n');
  if (end < 0) throw new Error('PIN keyboard handler closing not found');
  let block = after.slice(0, end + 2);
  block = block.replace("document.addEventListener('keydown', (e) => {", 'function _pinKeyboardHandlerFn(e) {');
  return block + '\n';
}
const pinKeyboardNamedFn = extractPinKeyboardHandlerAsNamedFn();
sources.push(pinKeyboardNamedFn);

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

let pinPressCalls = [];
let pinDeleteCalls = 0;
global.pinKeyPress = (d) => pinPressCalls.push(d);
global.pinDelete = () => { pinDeleteCalls++; };
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
}

// ---------------------------------------------------------------------------
// SCENARIO 22 — PIN keyboard active when view visible
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 22 — pin keyboard handler (visible) ===');
resetState();
installPinKeyboard();
pinViewState.hidden = false;  // pinView visible (offsetParent != null)
pinPressCalls = [];
pinDeleteCalls = 0;

fireKeyWith('5');
eq('SC22.a digit pressed → pinKeyPress("5") called', pinPressCalls, ['5']);

fireKeyWith('Backspace');
eq('SC22.b Backspace pressed → pinDelete called', pinDeleteCalls, 1);

fireKeyWith('Delete');
eq('SC22.c Delete pressed → pinDelete called again', pinDeleteCalls, 2);

// Non-digit, non-Backspace key passes through
fireKeyWith('a');
fireKeyWith('Enter');
fireKeyWith('Tab');
eq('SC22.d other keys → no pinKeyPress', pinPressCalls, ['5']);
eq('SC22.e other keys → no pinDelete', pinDeleteCalls, 2);

uninstallPinKeyboard();

// ---------------------------------------------------------------------------
// SCENARIO 23 — PIN keyboard gated by offsetParent (the documented critical fix)
// ---------------------------------------------------------------------------
console.log('\n=== SCENARIO 23 — pin keyboard handler (HIDDEN via offsetParent) ===');
resetState();
installPinKeyboard();
pinViewState.hidden = true;  // pinView HIDDEN (offsetParent === null)
pinPressCalls = [];
pinDeleteCalls = 0;

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
pinPressCalls = [];
pinDeleteCalls = 0;

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
const storageMock = {
  _mode: 'ok',  // 'ok' | 'setItem-throws' | 'getItem-invalid-json' | 'unavailable'
  _setItemCount: 0,
  _getItemCount: 0,
  setItem(k, v) {
    this._setItemCount++;
    if (this._mode === 'setItem-throws' || this._mode === 'unavailable') {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    }
  },
  getItem(k) {
    this._getItemCount++;
    if (this._mode === 'unavailable') {
      throw new Error('SecurityError');
    }
    if (this._mode === 'getItem-invalid-json') {
      return '{{{not-valid-json}}}';
    }
    return null;
  },
  removeItem(k) {},
  clear() {},
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

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log('\n=== SUMMARY ===');
console.log('Pass: ' + pass + '\nFail: ' + fail);
console.log('Total dispatch ops (add/remove) logged: ' + dispatchLog.length);
process.exit(fail === 0 ? 0 : 1);
