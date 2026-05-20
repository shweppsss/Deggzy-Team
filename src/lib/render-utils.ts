// ============================================================================
// Render utility helpers — extracted to TS in Phase TS-4.
//
// Three small, pure helper groups that the legacy inline render code in
// `index.html` reads as bare globals (`icon(...)`, `hydrateIcons()`,
// `emptyState(...)`, `parseDate(...)`, `isFutureOrToday(...)`).
//
// To keep the legacy call sites unchanged, /src/main.ts re-attaches these
// as bare globals on `window` (not under `window.App`) — this matches the
// historical surface where they were declared at module scope inside the
// big `<script>` tag.
//
// DESIGN RULES:
// - Pure functions / data tables. No side effects at module load.
// - No domain knowledge (no Supabase, no audio, no state mentions).
// - hydrateIcons() reads the DOM but writes ONLY `innerHTML` + a sentinel
//   data-attribute (`data-icn-hydrated="1"`). Idempotent.
// ============================================================================

// ---------------------------------------------------------------------------
// ICONS — single inline SVG set, stroke 1.5px, currentColor
// ---------------------------------------------------------------------------
export const ICONS: Record<string, string> = {
  bolt:        '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  check:       '<path d="m5 12 5 5 9-11"/>',
  target:      '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  link:        '<path d="M7 17 17 7"/><path d="M9 7h8v8"/>',
  chevron:     '<path d="m9 6 6 6-6 6"/>',
  plus:        '<path d="M12 5v14M5 12h14"/>',
  close:       '<path d="M6 6 18 18M18 6 6 18"/>',
  play:        '<path d="M8 5v14l11-7Z" fill="currentColor" stroke="none"/>',
  pause:       '<path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor" stroke="none"/>',
  pin:         '<path d="M12 2c3 0 5 2 5 5 0 4-5 10-5 10S7 11 7 7c0-3 2-5 5-5Z"/><circle cx="12" cy="7" r="2"/>',
  person:      '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>',
  calendar:    '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  music:       '<path d="M9 18V6l11-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  sparkle:     '<path d="M12 3v6M12 15v6M3 12h6M15 12h6"/><path d="m6 6 3 3M15 15l3 3M6 18l3-3M15 9l3-3"/>',
};

export function icon(name: string, size: number = 16, extraClass: string = ''): string {
  const path = ICONS[name];
  if (!path) return '';
  const cls = `icn icn-${name}${extraClass ? ' ' + extraClass : ''}`;
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export function hydrateIcons(): void {
  // Idempotent — skip elements already hydrated to avoid DOM thrash + flicker
  // if hydrateIcons is called more than once (boot + after late renders).
  document.querySelectorAll<HTMLElement>('[data-icn]:not([data-icn-hydrated])').forEach((el) => {
    const name = el.dataset.icn || '';
    const size = parseInt(el.dataset.size || '16', 10) || 16;
    el.innerHTML = icon(name, size);
    el.dataset.icnHydrated = '1';
  });
}

// ---------------------------------------------------------------------------
// EMPTY STATES — minimal illustrations + CTA
// ---------------------------------------------------------------------------
export const EMPTY_ART: Record<string, string> = {
  todos: `<svg viewBox="0 0 120 100" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="20" y="18" width="80" height="14" rx="3"/><rect x="20" y="40" width="80" height="14" rx="3"/><rect x="20" y="62" width="80" height="14" rx="3"/><circle cx="30" cy="25" r="3.5"/><circle cx="30" cy="47" r="3.5"/><path d="M27 69l2.5 2.5L34 67" stroke-width="1.8"/></svg>`,
  inspirations: `<svg viewBox="0 0 120 100" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="22" y="20" width="34" height="42" rx="3"/><rect x="62" y="20" width="34" height="26" rx="3"/><rect x="62" y="52" width="34" height="26" rx="3"/><path d="M28 50l8-10 6 6 8-12 6 8"/><circle cx="38" cy="30" r="2.5"/><path d="M72 32h14M72 38h10" opacity=".7"/><path d="M72 64h14M72 70h10" opacity=".7"/></svg>`,
  team: `<svg viewBox="0 0 120 100" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="40" cy="38" r="11"/><path d="M22 78c0-10 8-16 18-16s18 6 18 16"/><circle cx="78" cy="42" r="9"/><path d="M64 80c0-8 6-14 14-14s14 6 14 14" opacity=".6"/></svg>`,
  tracks: `<svg viewBox="0 0 120 100" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="22" y="22" width="56" height="56" rx="6"/><circle cx="50" cy="50" r="14"/><circle cx="50" cy="50" r="2" fill="currentColor"/><path d="M84 30l6 2v34M90 32c-3 0-6 2-6 5s3 5 6 5 6-2 6-5"/></svg>`,
  calendar: `<svg viewBox="0 0 120 100" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="22" y="24" width="76" height="56" rx="4"/><path d="M22 38h76M38 18v12M82 18v12"/><rect x="36" y="50" width="12" height="10" rx="1.5" opacity=".5"/><rect x="54" y="50" width="12" height="10" rx="1.5"/><rect x="72" y="50" width="12" height="10" rx="1.5" opacity=".5"/></svg>`,
  budget: `<svg viewBox="0 0 120 100" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="20" y="34" width="80" height="46" rx="4"/><path d="M20 46h80"/><circle cx="76" cy="62" r="6"/><path d="M35 28l25-10 25 10" opacity=".6"/></svg>`,
};

export function emptyState(
  kind: string,
  title: string,
  hint?: string,
  ctaLabel?: string,
  ctaOnclick?: string,
): string {
  const art = EMPTY_ART[kind] || EMPTY_ART.todos;
  const cta = ctaLabel
    ? `<button type="button" class="btn btn-primary empty-state-cta" onclick="${ctaOnclick || ''}">${icon('plus', 14)}${ctaLabel}</button>`
    : '';
  return `
    <div class="empty-state">
      <div class="empty-state-art">${art}</div>
      <div class="empty-state-title">${title}</div>
      ${hint ? `<div class="empty-state-hint">${hint}</div>` : ''}
      ${cta}
    </div>`;
}

// ---------------------------------------------------------------------------
// DATE UTILITY — single parse path with NaN guard
// ISO 'YYYY-MM-DD' is cross-browser safe; any other format we treat as invalid.
// ---------------------------------------------------------------------------
export function parseDate(s: string | null | undefined): Date | null {
  if (!s || typeof s !== 'string') return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function isFutureOrToday(s: string | null | undefined, now?: Date): boolean {
  const d = parseDate(s);
  if (!d) return false;
  const ref = now || new Date();
  ref.setHours(0, 0, 0, 0);
  return d >= ref;
}
