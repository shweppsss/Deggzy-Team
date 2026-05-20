// ============================================================================
// Dashboard widget — greeting (name + alias avatar initial). Phase TS-14A.
// PURE — takes resolved data, returns text/initial.
// ============================================================================

import type { DashboardProfile, DashboardUser } from '../types';

export interface GreetingResult {
  /** Display name shown next to "Bienvenue". */
  name: string;
  /** First-letter avatar initial. Defaults to '?'. */
  avatarInitial: string;
  /** Alias (e.g. stage name). May be empty string. */
  alias: string;
}

/** Resolve the greeting from profile/user — fallback chain identical to inline. */
export function buildGreeting(profile: DashboardProfile | null, user: DashboardUser | null, stateName?: string): GreetingResult {
  const name = (profile && profile.name)
    || stateName
    || (user && user.email ? user.email.split('@')[0] : '')
    || 'à toi';
  const alias = (profile && profile.alias) || '';
  const initial = (name || '?').charAt(0).toUpperCase() || '?';
  return { name: String(name), avatarInitial: initial, alias: String(alias) };
}
