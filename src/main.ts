// ============================================================================
// Deggzy-Team — TypeScript migration entry point
// ============================================================================
//
// Phase TS-0 (current): this file is deliberately empty. Its only purpose is
// to make the Vite + TS build pipeline produce a valid bundle that the
// legacy index.html can load. The app's behavior is 100% unchanged: every
// piece of business logic still lives in the inline <script> block of
// index.html, and is loaded BEFORE this module runs (since classic scripts
// in HTML execute synchronously and module scripts are deferred by spec).
//
// Phase TS-1+ will progressively extract the inline blocks into typed
// modules under /src/core/, /src/auth/, /src/calendar/, etc. Each
// extraction will:
//   1. Move the code out of index.html into a typed .ts module.
//   2. Import + re-expose the module via `window.X = X` so that the
//      remaining inline code and inline handlers keep seeing the same
//      global names during the transition.
//   3. Drop the inline block from index.html in the same PR.
//   4. Verify the harness (docs/architecture/verification-0.12-…) still
//      passes — it auto-extracts functions FROM index.html, so once a
//      function moves out, the harness extraction needs an update.
//
// When the migration is complete, the inline <script> block in index.html
// is empty (or gone), all logic lives in /src/, and the `window.X = X`
// shims can be removed.
//
// For TS-0, the bundle is genuinely empty. Nothing happens at runtime
// from this module. Verifying that the build + deploy pipeline produces
// a working site IS the deliverable of TS-0.
// ============================================================================

export {};
