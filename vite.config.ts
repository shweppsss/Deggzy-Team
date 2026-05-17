import { defineConfig } from 'vite';

// GitHub Pages serves this project from the subpath `/Deggzy-Team/`.
// The `base` option ensures asset URLs (the bundled JS/CSS chunks Vite
// emits) are rewritten to that subpath in the built index.html.
//
// For local dev with `npm run dev`, Vite serves at root `/`, so set base
// conditionally — but since dev is rare for an HTML-heavy single-file
// app, keep base always set to the deploy subpath. Local preview will
// also use this subpath via `npm run preview`.
export default defineConfig({
  base: '/Deggzy-Team/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // The legacy index.html stays at the repo root and is Vite's HTML
    // entry. Vite scans it for `<script type="module" src="...">` tags
    // and bundles those, leaving all other inline `<script>` blocks and
    // inline `<style>` untouched. During phase TS-0 only one such tag
    // exists (loading the empty /src/main.ts).
    rollupOptions: {
      input: {
        main: 'index.html',
      },
    },
    // Keep human-readable chunk names so deploy artifacts are inspectable.
    // Hashing still happens for cache busting.
    sourcemap: true,
  },
  server: {
    port: 5173,
  },
});
