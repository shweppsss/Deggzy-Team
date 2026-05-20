// ============================================================================
// Dashboard widget — release countdown card. Phase TS-14A. PURE HTML.
// ============================================================================

import type { DashboardDeps, DashboardEvent } from '../types';
import {
  releaseDaysLeft,
  releaseState,
  releaseMicrocopy,
  releaseTitle,
  formatReleaseDate,
} from '../calculations';

export interface ReleaseResult {
  /** True when no release is set or its date is unparseable — hide the card. */
  hidden: boolean;
  /** Inner HTML for the card. Empty when hidden. */
  html: string;
  /** Dataset attributes for the card (mount.ts applies). */
  dataset: { state: string; ariaLabel: string } | null;
  /** Event id for the click → openDetail dispatch. */
  eventId: string | null;
}

export function buildReleaseCard(nextRelease: DashboardEvent | null, today: Date, deps: DashboardDeps): ReleaseResult {
  if (!nextRelease) {
    return { hidden: true, html: '', dataset: null, eventId: null };
  }
  const daysLeft = releaseDaysLeft(today, nextRelease.date);
  if (daysLeft === null) {
    return { hidden: true, html: '', dataset: null, eventId: null };
  }

  const stateKey = releaseState(daysLeft);
  const microcopy = releaseMicrocopy(daysLeft);
  const title = releaseTitle(nextRelease.title);
  const dateLong = formatReleaseDate(nextRelease.date);

  const jLabel = daysLeft <= 0 ? 'J' : 'J-' + daysLeft;
  const jSub = daysLeft <= 0
    ? "Aujourd'hui"
    : (daysLeft === 1 ? 'jour avant lancement' : 'jours avant lancement');

  const html = `
    <div class="dash-release-countdown">
      <div class="dash-release-eyebrow">
        <span class="dash-release-dot" aria-hidden="true"></span>
        Prochaine sortie
      </div>
      <div class="dash-release-jminus">${deps.escapeHtml(jLabel)}</div>
      <div class="dash-release-jlabel">${deps.escapeHtml(jSub)}</div>
    </div>
    <div class="dash-release-meta">
      <div class="dash-release-title">${deps.escapeHtml(title)}</div>
      <div class="dash-release-date">${deps.escapeHtml(dateLong)}</div>
      <span class="dash-release-badge">${deps.escapeHtml(microcopy)}</span>
    </div>
  `;

  return {
    hidden: false,
    html,
    dataset: { state: stateKey, ariaLabel: 'Prochaine sortie : ' + title + ', ' + jLabel + ', ' + dateLong },
    eventId: nextRelease.id,
  };
}
