// ============================================================================
// Dashboard widget — upcoming events list. Phase TS-14A. PURE HTML.
// ============================================================================

import type { DashboardDeps, DashboardEvent } from '../types';

export interface UpcomingResult {
  /** True when the slice is empty → mount.ts swaps to the empty-state element. */
  empty: boolean;
  /** Inline list HTML (non-empty case). */
  html: string;
  /** Empty-state HTML (empty case). mount.ts uses outerHTML for this. */
  emptyHtml: string;
}

const UPCOMING_LIMIT = 6;

export function buildUpcomingList(upcoming: DashboardEvent[], deps: DashboardDeps): UpcomingResult {
  const slice = upcoming.slice(0, UPCOMING_LIMIT);
  if (slice.length === 0) {
    return {
      empty: true,
      html: '',
      emptyHtml: deps.emptyState(
        'calendar',
        'Aucun rendez-vous à venir',
        'Planifie ton prochain shoot, mix, ou session.',
        'Nouveau rendez-vous',
        'openEventModal()',
      ),
    };
  }
  const html = slice.map((e) => {
    const d = new Date(e.date || '');
    const day = d.getDate();
    const month = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
    const metaParts: string[] = [];
    if (e.time) metaParts.push(deps.formatEventTime(e.time));
    if (e.location) metaParts.push(`${deps.icon('pin', 11)} ${deps.escapeHtml(e.location)}`);
    if (e.with) metaParts.push(`${deps.icon('person', 11)} ${deps.escapeHtml(e.with)}`);
    return `
          <div class="dash-upcoming-row" data-event-id="${e.id}" onclick="openDetail('event','${e.id}')">
            <div class="dash-upcoming-date">
              <div class="dash-upcoming-date-day">${day}</div>
              <div class="dash-upcoming-date-month">${month}</div>
            </div>
            <div class="dash-upcoming-body">
              <div class="dash-upcoming-eyebrow">${deps.typeLabel(e.type)}</div>
              <div class="dash-upcoming-title">${deps.escapeHtml(e.title)}</div>
              ${metaParts.length ? `<div class="dash-upcoming-meta">${metaParts.join('<span style="opacity:.4;">·</span>')}</div>` : ''}
            </div>
            <div class="dash-upcoming-trail">${deps.icon('chevron', 16)}</div>
          </div>
        `;
  }).join('');
  return { empty: false, html, emptyHtml: '' };
}
