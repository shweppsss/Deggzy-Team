// ============================================================================
// Format utilities — pure formatters. Phase TS-8.
//
// Extracted from inline <script> in index.html to a typed TS module. These
// helpers are stateless, side-effect-free, and operate purely on their
// inputs. Used everywhere a string needs to be humanized (dates, durations,
// relative times, escaped HTML).
//
// DESIGN RULES (non-negotiable):
// - Pure functions only. NO `document`, NO `window`, NO `state`, NO IO.
// - Idempotent and deterministic: same input → same output (modulo
//   `Date.now()` for `formatRelativeShort`, which is itself the time source).
// - Tolerant inputs: null / undefined / wrong types return safe defaults
//   ('' for strings, '' for ranges, the input itself for escape on falsy).
// ============================================================================

/**
 * HTML-escape a string. Falsy input returns ''.
 * Replaces & < > " ' with their HTML entities.
 */
export function escapeHtml(s: string | null | undefined): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return (s || '').replace(/[&<>"']/g, (c) => map[c]);
}

/** Short date "12 mai" using fr-FR locale. */
export function formatDate(s: string | null | undefined): string {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Long date "lundi 12 mai 2026". */
export function formatDateLong(s: string | null | undefined): string {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** "HH:MM:SS" → "HH:MM" — empty string for falsy input. */
export function formatEventTime(time: string | null | undefined): string {
  if (!time) return '';
  return time.slice(0, 5);
}

/**
 * Convert "HH:MM" → minutes since midnight. Returns `null` if the input
 * is empty / not a string / malformed.
 */
export function timeToMins(t: string | null | undefined): number | null {
  if (!t || typeof t !== 'string') return null;
  const parts = t.split(':').map(Number);
  const h = parts[0];
  const m = parts[1];
  if (isNaN(h)) return null;
  return h * 60 + (isNaN(m) ? 0 : m);
}

/** Minutes since midnight → "HH:MM" (zero-padded). */
export function minsToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

/**
 * Compact French duration label. 0 → '', <60 → "45 min", multiples of 60 →
 * "2 h", otherwise → "1 h 30". Negative / non-numeric → ''.
 */
export function formatDuration(mins: number | string | null | undefined): string {
  const n = Math.max(0, parseInt(String(mins), 10) || 0);
  if (n === 0) return '';
  if (n < 60) return n + ' min';
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (m === 0) return h + ' h';
  return h + ' h ' + String(m).padStart(2, '0');
}

/**
 * "14:00 – 15:30" given a start time + duration in minutes. Empty string
 * if `time` is falsy or unparseable. Caps the end at 23:59 (same as the
 * original inline behavior — events don't roll over midnight in the UI).
 */
export function formatEventRange(
  time: string | null | undefined,
  durationMins: number | string | null | undefined,
): string {
  if (!time) return '';
  const start = timeToMins(time);
  if (start == null) return '';
  const dur = parseInt(String(durationMins), 10) || 60;
  const end = Math.min(24 * 60 - 1, start + dur);
  return formatEventTime(time) + ' – ' + formatEventTime(minsToTime(end));
}

/**
 * Short relative date — "à l'instant" / "il y a 5 min" / "hier" / "il y
 * a 3 j" / absolute short date beyond a week. Returns '' for falsy or
 * unparseable input.
 */
export function formatRelativeShort(iso: string | number | null | undefined): string {
  if (iso === null || iso === undefined || iso === '') return '';
  const t = typeof iso === 'number' ? iso : Date.parse(String(iso));
  if (isNaN(t)) return '';
  const diffSec = Math.floor((Date.now() - t) / 1000);
  if (diffSec < 45) return "à l'instant";
  if (diffSec < 90) return 'il y a 1 min';
  const min = Math.floor(diffSec / 60);
  if (min < 60) return 'il y a ' + min + ' min';
  if (min < 120) return 'il y a 1 h';
  const h = Math.floor(min / 60);
  if (h < 24) return 'il y a ' + h + ' h';
  const d = Math.floor(h / 24);
  if (d < 2) return 'hier';
  if (d < 7) return 'il y a ' + d + ' j';
  // Beyond a week → absolute short date
  return new Date(t).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: t < Date.now() - 365 * 24 * 3600 * 1000 ? 'numeric' : undefined,
  });
}
