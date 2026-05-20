// ============================================================================
// Audio pill — PURE time formatting. Phase TS-20.
//
// `formatAudioTime(seconds)` → "m:ss" with a 0:00 fallback for non-finite or
// non-positive input. Mirrors the legacy inline `_formatAudioTime`.
// ============================================================================

export function formatAudioTime(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds as number) || (seconds as number) <= 0) return '0:00';
  const s = Math.floor(seconds as number);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}
