// ============================================================================
// Team widget — single member row. Phase TS-14D. PURE HTML.
// ============================================================================

import type { TeamDeps, TeamMember } from '../types';
import { isPendingMember, memberInitials } from '../calculations';

export function buildMemberRow(m: TeamMember, deps: TeamDeps): string {
  if (!m || !m.id) return '';
  const isPending = isPendingMember(m);
  const subBits: string[] = [];
  if (m.role) subBits.push(deps.escapeHtml(m.role));
  if (m.note) subBits.push(deps.escapeHtml(m.note));
  return `
            <button type="button" class="list-row" data-id="${m.id}" data-kind="member" data-action="open" aria-label="${deps.escapeHtml(m.name || m.role || 'Membre')}">
              <span class="list-row-lead"${isPending ? ' style="opacity:0.45"' : ''}>${memberInitials(m)}</span>
              <span class="list-row-body">
                <span class="list-row-title">${deps.escapeHtml(m.name || '—')}</span>
                <span class="list-row-sub">${subBits.join('<span class="sep">·</span>')}</span>
              </span>
              <span class="list-row-trail">
                ${isPending ? '<span class="list-row-badge">À pourvoir</span>' : ''}
                <span class="list-row-chev" aria-hidden="true">${deps.icon('chevron', 14)}</span>
              </span>
            </button>
          `;
}
