// ============================================================================
// Render shared — ISO date helpers used by the calendar (and any future
// render section that handles dates). Phase TS-13C.
//
// PURE — no DOM, no state, no window reads. Deterministic given a stable
// `now` clock (Date.now is read inside helpers that explicitly take a
// reference date as an arg).
// ============================================================================

/** YYYY-MM-DD using local-time components (matches the inline `_isoDate`). */
export function toIsoDate(d: Date): string {
  return (
    d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

/** Parse an ISO date string back to a local-time Date. Returns null if invalid. */
export function parseIsoDate(s: string | null | undefined): Date | null {
  if (!s || typeof s !== 'string') return null;
  const parts = s.split('-').map(Number);
  const y = parts[0], m = parts[1], d = parts[2];
  if (!y || !m || !d || isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return new Date(y, m - 1, d);
}

/** Monday of the week containing `d`. Always returns a NEW Date. */
export function getMondayOf(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (out.getDay() + 6) % 7; // 0 = Monday
  out.setDate(out.getDate() - dow);
  return out;
}

/** Add `n` days to an ISO date string. Returns the input if not parseable. */
export function addDays(iso: string, n: number): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

/** Day delta between two ISO date strings. Returns 0 if either side is invalid. */
export function diffDays(aIso: string, bIso: string): number {
  const a = parseIsoDate(aIso);
  const b = parseIsoDate(bIso);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Min of two ISO date strings (lexicographic — works because YYYY-MM-DD). */
export function isoMin(a: string | null | undefined, b: string | null | undefined): string {
  return (a && b) ? (a < b ? a : b) : (a || b || '');
}

/** Max of two ISO date strings. */
export function isoMax(a: string | null | undefined, b: string | null | undefined): string {
  return (a && b) ? (a > b ? a : b) : (a || b || '');
}
