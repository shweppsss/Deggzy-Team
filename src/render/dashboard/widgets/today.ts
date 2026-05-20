// ============================================================================
// Dashboard widget — today agenda. Phase TS-14A. PURE HTML.
// ============================================================================

import type { DashboardDeps, DashboardEvent } from '../types';

export interface TodayResult {
  /** Caption "rien de prévu" / "N rendez-vous". */
  meta: string;
  /** HTML for #todayAgendaWrap. Empty-state when no events. */
  html: string;
}

const EMPTY_HTML =
  '<div style="padding: 28px 12px; text-align: left; color: var(--text-soft); font: var(--font-body); letter-spacing: var(--tracking-body);">' +
  "Aucun rendez-vous aujourd'hui — profite, ou planifie quelque chose." +
  '</div>';

export function buildTodayAgenda(events: DashboardEvent[], deps: DashboardDeps): TodayResult {
  if (!events || events.length === 0) {
    return { meta: 'rien de prévu', html: EMPTY_HTML };
  }
  const meta = `${events.length} rendez-vous`;
  const itemsHtml = events.map((e) => `
            <div class="agenda-item" onclick="openDetail('event','${e.id}')">
              <div class="agenda-time">${e.time ? deps.formatEventTime(e.time) : '—'}</div>
              <div class="agenda-divider" data-type="${e.type}"></div>
              <div class="agenda-body">
                <div class="agenda-type">${deps.typeLabel(e.type)}${e.location ? ' · ' + deps.escapeHtml(e.location) : ''}</div>
                <div class="agenda-title">${deps.escapeHtml(e.title)}</div>
                ${e.with ? `<div class="agenda-with">avec ${deps.escapeHtml(e.with)}</div>` : ''}
              </div>
            </div>
          `).join('');
  const html = `
        <div class="agenda-list">
          ${itemsHtml}
        </div>
      `;
  return { meta, html };
}
