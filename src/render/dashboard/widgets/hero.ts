// ============================================================================
// Dashboard widget — hero (eyebrow + countdown number + project phase row).
// Phase TS-14A. PURE.
// ============================================================================

import type { DashboardDeps, DashboardPhase } from '../types';

export interface HeroResult {
  /** Long-form date "lundi 20 mai" — locale fr-FR. */
  eyebrow: string;
  /** Days until R.I.C.H. */
  count: number;
  /** Caption under the count ("jour avant…" vs "jours avant…"). */
  label: string;
  /** HTML for the phase row (dot + label/title + chevron). */
  phaseHtml: string;
}

/** Build the hero block from (today, daysLeft, phase, deps). */
export function buildHero(today: Date, daysLeft: number, phase: DashboardPhase, deps: DashboardDeps): HeroResult {
  const eyebrow = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const label = daysLeft === 1
    ? 'jour avant R.I.C.H · 11 sept. 2026'
    : 'jours avant R.I.C.H · 11 sept. 2026';
  const phaseHtml = `
      <div class="dash-hero-phase-dot"></div>
      <div class="dash-hero-phase-body">
        <div class="dash-hero-phase-eyebrow">Phase actuelle · ${deps.escapeHtml(phase.label)}</div>
        <div class="dash-hero-phase-title">${deps.escapeHtml(phase.title)}</div>
      </div>
      <span style="color:var(--text-dim);">${deps.icon('chevron', 16)}</span>
    `;
  return { eyebrow, count: daysLeft, label, phaseHtml };
}
