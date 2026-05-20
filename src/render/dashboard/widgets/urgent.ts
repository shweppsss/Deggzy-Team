// ============================================================================
// Dashboard widget — urgent priority box. Phase TS-14A. PURE HTML.
// ============================================================================

import type { DashboardDeps, DashboardTodo, DashboardRole } from '../types';

export interface UrgentResult {
  hidden: boolean;
  html: string;
}

const PRIORITY_BORDER: Record<string, string> = {
  critique: 'var(--danger)',
  urgent:   'var(--warning)',
  important:'var(--accent)',
};

/**
 * Build the urgent priority box. When `urgentList` is empty, returns
 * { hidden: true, html: '' } so mount.ts can hide the element cleanly.
 */
export function buildUrgent(urgentList: DashboardTodo[], roleKey: string, role: DashboardRole, deps: DashboardDeps): UrgentResult {
  if (!urgentList || urgentList.length === 0) {
    return { hidden: true, html: '' };
  }
  const scoped = roleKey !== 'autre' && roleKey !== 'manager';
  const headTitle = scoped
    ? `Pour toi · ${deps.escapeHtml(role.label)}`
    : `${urgentList.length} tâche${urgentList.length > 1 ? 's' : ''} à traiter en priorité`;

  const itemsHtml = urgentList.map((t) => {
    const p = deps.todoPriority(t);
    const borderColor = PRIORITY_BORDER[p] || 'var(--accent)';
    return `
            <div class="dash-urgent-item" data-priority="${p}" onclick="openDetail('todo','${t.id}')">
              <div class="todo-checkbox" style="border-color: ${borderColor};" onclick="event.stopPropagation(); toggleTodo('${t.id}')"></div>
              <div class="dash-urgent-item-text">${deps.escapeHtml(t.text)}</div>
              <div class="dash-urgent-item-meta">${t.due ? deps.formatDate(t.due) : ''}</div>
            </div>
          `;
  }).join('');

  const html = `
        <div class="dash-urgent-head">
          <span class="dash-urgent-flag">${deps.icon('bolt', 11)}${scoped ? 'Priorités' : 'Urgent'}</span>
          <span class="dash-urgent-title">${headTitle}</span>
        </div>
        <div class="dash-urgent-list">
          ${itemsHtml}
        </div>
      `;
  return { hidden: false, html };
}
