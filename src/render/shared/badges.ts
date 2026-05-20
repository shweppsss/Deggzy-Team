// ============================================================================
// Render shared — small badge HTML helpers used by the calendar (and any
// future section that needs warning chips). Phase TS-13C.
//
// PURE functions: (data) => string. No DOM, no state.
// ============================================================================

import { escapeHtml } from '../../lib/format-utils';

/** Overload badge — shown on a day cell when event count exceeds threshold. */
export function overloadBadgeHTML(count: number): string {
  return `<span class="cal-cell-overload-flag" title="Journée chargée — ${count} évènements">⚠ ${count}</span>`;
}

/** Conflict tooltip — comma-separated list of conflicting event titles. */
export function conflictTooltip(others: Array<{ title?: string }>): string {
  if (!others || !others.length) return '';
  const names = others.map((o) => o.title || 'Sans titre').join(', ');
  return 'Conflit avec : ' + names;
}

/** Multi-day span tooltip — e.g. "Jour 2 / 5". */
export function spanTooltip(spanIndex: number | undefined, spanTotal: number | undefined): string {
  if (!spanTotal || spanTotal <= 1 || spanIndex == null) return '';
  return `Jour ${spanIndex + 1} / ${spanTotal}`;
}

/** Span class — '' / ' is-span-start' / ' is-span-mid' / ' is-span-end'. */
export function spanClass(spanIndex: number | undefined, spanTotal: number | undefined): string {
  if (!spanTotal || spanTotal <= 1 || spanIndex == null) return '';
  if (spanIndex === 0) return ' is-span-start';
  if (spanIndex === spanTotal - 1) return ' is-span-end';
  return ' is-span-mid';
}

/** Combine multiple tooltip fragments into one ` — `-joined string. */
export function joinTooltips(...parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' — ');
}

// `escapeHtml` is re-exported because some badges directly format user input.
export { escapeHtml };
