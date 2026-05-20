// ============================================================================
// Team render — calculations. Phase TS-14D. PURE.
// ============================================================================

import type { TeamMember } from './types';

/** True when the member is a placeholder slot ("— Nom" / empty name). */
export function isPendingMember(m: TeamMember): boolean {
  const name = (m && m.name || '').trim();
  return !name || name.startsWith('—');
}

/** Initials for the avatar — 2 chars from full name; fallback to role initial. */
export function memberInitials(m: TeamMember): string {
  const name = (m && m.name || '').trim();
  if (!name || name.startsWith('—')) return ((m && m.role) || '?').charAt(0).toUpperCase();
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}
