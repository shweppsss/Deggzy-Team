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

   Run with:  node docs/architecture/verification-0.12-runtime-coexistence.js
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
    // detailPane intentionally not returned — the legacy global ESC handler
    // at L17740 queries this ID; verifying behavior under this real lookup
    // is part of the 0.14 scenarios.
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
  extractFn('openDetail'),
  extractFn('closeDetail'),
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

// Account menu uses `const` and `let` in its body, but the functions
// themselves are plain. We also need to declare `_weekDrag` as a global
// because the calendar fns expect it as a module-level binding.
let _weekDrag = null;
global._weekDrag = _weekDrag;

// Wrap in IIFE so the extracted functions live in a scope we control.
// We use `var` declarations explicitly (the extracted source uses `function`
// declarations which hoist).
const harness = `
  var _weekDrag = null;
  var _weekResize = null;
  var _calDrag = null;
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
    _globalEscRoutingFn,
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
// We make hydrateDetailAudio throw on the next call to simulate an IDB
// failure on a track open. This exercises the T1 catch path.
const originalHydrate = global.hydrateDetailAudio;
global.hydrateDetailAudio = () => { throw new Error('idb-down'); };
// Re-eval openDetail so the new throwing stub is captured by its closure
// (the extracted fn captured global at eval time; safer to re-eval).
let caught = null;
try { F.openDetail('track', 't1'); } catch (e) { caught = e.message; }
global.hydrateDetailAudio = originalHydrate;

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

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log('\n=== SUMMARY ===');
console.log('Pass: ' + pass + '\nFail: ' + fail);
console.log('Total dispatch ops (add/remove) logged: ' + dispatchLog.length);
process.exit(fail === 0 ? 0 : 1);
