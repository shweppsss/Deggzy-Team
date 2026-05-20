// ============================================================================
// Role modal — open / close / select. Phase TS-9.
//
// Lifecycle ONLY. The save flow (saveRole — async, touches Supabase + state
// + multiple render*() calls) stays inline. saveRole reads the pending key
// via `getPendingRoleKey()` exposed on window.
//
// What IS here:
//   - openRoleModal()   — hide account menu, populate the grid, mark current
//                         role as active, set _pendingRoleKey, show modal.
//   - closeRoleModal()  — hide modal, clear _pendingRoleKey.
//   - selectRole(key)   — update _pendingRoleKey, repaint .active flags.
//   - getPendingRoleKey() — for the inline saveRole to read.
// ============================================================================

import { showModal, hideModal } from './shared';
import { escapeHtml } from '../../lib/format-utils';
import { getRoles, getCurrentRoleKey, hideAccountMenu } from '../../lib/legacy-bridge';

const ROLE_DESCRIPTIONS: Record<string, string> = {
  artiste: 'Tes sorties, sessions studio, interviews, podcasts.',
  manager: 'Vue globale équipe, blocages, releases à risque.',
  'ingenieur-son': 'Mixs, masters, sessions studio, exports audio.',
  producteur: 'Beats, sessions, exports, listening, milestones.',
  realisateur: 'Clips, shoots, montages, validations vidéo.',
  monteur: 'Montages, exports vidéo, livraisons clips.',
  graphiste: 'Covers, assets, exports branding, livraisons.',
  'community-manager': 'Posts, campagnes, TikTok / Insta, timing promo.',
  autre: 'Vue par défaut. Tu pourras affiner plus tard.',
};

let _pendingRoleKey: string | null = null;

export function getPendingRoleKey(): string | null {
  return _pendingRoleKey;
}

export function selectRole(key: string): void {
  _pendingRoleKey = key;
  document.querySelectorAll<HTMLElement>('#roleModalGrid .role-option').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.roleKey === key);
  });
}

export function openRoleModal(): void {
  hideAccountMenu();
  const grid = document.getElementById('roleModalGrid');
  if (!grid) return;
  const currentKey = getCurrentRoleKey();
  _pendingRoleKey = currentKey;
  const roles = getRoles();
  grid.innerHTML = roles
    .map(
      (r) => `
    <button type="button" class="role-option ${r.key === currentKey ? 'active' : ''}"
            data-role-key="${escapeHtml(r.key)}"
            onclick="_selectRole('${escapeHtml(r.key)}')">
      <span class="role-option-label">${escapeHtml(r.label)}</span>
      <span class="role-option-sub">${escapeHtml(ROLE_DESCRIPTIONS[r.key] || '')}</span>
    </button>
  `,
    )
    .join('');
  showModal('roleModal');
}

export function closeRoleModal(): void {
  hideModal('roleModal');
  _pendingRoleKey = null;
}
