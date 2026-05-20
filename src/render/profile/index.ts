// ============================================================================
// Profile render — dispatcher only. Phase TS-15.
//
// The profile section is split into 8 inline sub-renderers (Skills, Socials,
// Notifs, Stats, Activity, Badges, AvatarRefresh, AliasEdit). Each one
// touches features and side-effects (IDB, Sentry, badge eval) that are
// out of scope for TS-15. We extract the DISPATCHER + the view-model
// resolver. Sub-renderers stay inline and are invoked via hooks.
// ============================================================================

import { escapeHtml } from '../../lib/format-utils';

export interface ProfileViewModel {
  name: string;
  alias: string;
  roleLabel: string;
  since?: string;
  bio?: string;
  email?: string;
  phone?: string;
  specialty?: string;
  activityVisibility?: string;
  [key: string]: unknown;
}

export interface ProfileSideEffects {
  /** Returns the legacy `_getProfileViewModel()` result. */
  getViewModel: () => ProfileViewModel;
  /** "il y a 3 mois" style label for the `Membre depuis` line. */
  relativeSinceLong?: (iso: string | undefined) => string;
  /** Per-sub-section renderers — kept inline (large + feature-coupled). */
  renderStats?: (vm: ProfileViewModel) => void;
  renderActivity?: (vm: ProfileViewModel) => void;
  renderSkills?: (vm: ProfileViewModel) => void;
  renderSocials?: (vm: ProfileViewModel) => void;
  renderNotifs?: (vm: ProfileViewModel) => void;
  renderBadges?: (vm: ProfileViewModel) => void;
  /** Sentry DSN field hydration (no-op if Sentry not configured). */
  hydrateSentryDsnField?: () => void;
  /** Async avatar refresh from IDB / Supabase Storage. */
  refreshProfileAvatar?: (vm: ProfileViewModel) => Promise<void> | void;
}

let _fx: ProfileSideEffects | null = null;

export function registerProfileSideEffects(hooks: ProfileSideEffects): void {
  _fx = hooks;
}

/** PURE: avatar initial from a name (defensive against null/empty). */
export function profileAvatarInitial(name: string | undefined): string {
  return (name || '?').trim().charAt(0).toUpperCase() || '?';
}

/** DOM mount — runs the full profile render pass. */
export function renderProfileView(): void {
  if (!_fx) return;
  const vm = _fx.getViewModel();

  // Header
  const nameEl = document.getElementById('profileName');
  if (nameEl) nameEl.textContent = vm.name;
  const aliasEl = document.getElementById('profileAlias');
  if (aliasEl && document.activeElement !== aliasEl) aliasEl.textContent = vm.alias;
  const aliasLine = document.getElementById('profileAliasLine') as HTMLElement | null;
  if (aliasLine) aliasLine.style.display = vm.alias ? '' : 'flex';

  const initialEl = document.getElementById('profileAvatarInitial');
  if (initialEl) initialEl.textContent = profileAvatarInitial(vm.name);

  const roleLabelEl = document.getElementById('profileRoleLabel');
  if (roleLabelEl) roleLabelEl.textContent = vm.roleLabel;
  const sinceEl = document.getElementById('profileSince');
  if (sinceEl) sinceEl.textContent = _fx.relativeSinceLong ? _fx.relativeSinceLong(vm.since) : (vm.since || '');

  // Anti-clobber: skip overwriting whichever input the user is currently editing.
  const active = document.activeElement;
  const setIf = (id: string, value: string | undefined) => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    if (el && active !== el) el.value = value || '';
  };
  setIf('profileBio', vm.bio);
  setIf('profileEmail', vm.email);
  setIf('profilePhone', vm.phone);
  setIf('profileSpecialty', vm.specialty);
  setIf('profileActivityVisibility', vm.activityVisibility);

  // Sub-renderers — still inline, feature-coupled. Each is wrapped so a
  // failure in one doesn't abort the others.
  const safe = (name: string, fn?: (vm: ProfileViewModel) => void) => {
    if (!fn) return;
    try { fn(vm); } catch (e) { console.warn('[profile] ' + name + ' failed:', e); }
  };
  safe('stats', _fx.renderStats);
  safe('activity', _fx.renderActivity);
  safe('skills', _fx.renderSkills);
  safe('socials', _fx.renderSocials);
  safe('notifs', _fx.renderNotifs);
  safe('badges', _fx.renderBadges);

  if (_fx.hydrateSentryDsnField) {
    try { _fx.hydrateSentryDsnField(); } catch (_e) { /* no-op */ }
  }
  if (_fx.refreshProfileAvatar) {
    try { Promise.resolve(_fx.refreshProfileAvatar(vm)).catch(() => {}); } catch (_e) { /* no-op */ }
  }
}

// `escapeHtml` is re-exported for sub-widgets that may eventually migrate.
export { escapeHtml };
