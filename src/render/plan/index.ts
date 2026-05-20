// ============================================================================
// Plan render — barrel. Phase TS-15.
//
// Plan renders the 5 strategic phases as a vertical stack of cards.
// Pure HTML composition; no business logic, no DOM access outside mount.
// ============================================================================

import { escapeHtml } from '../../lib/format-utils';

export interface PlanPhase {
  label: string;
  dates?: string;
  title?: string;
  desc?: string;
  items?: string[];
}

export interface PlanDeps {
  /** Phases registry — injected from main.ts (still inline `PHASES`). */
  phases: ReadonlyArray<PlanPhase>;
}

/** PURE: compose the phases HTML. */
export function buildPlanView(deps: PlanDeps): string {
  return deps.phases.map((p, idx) => {
    const items = Array.isArray(p.items) ? p.items : [];
    const head = items.slice(0, 3).map((i) => `<li>${escapeHtml(i)}</li>`).join('');
    const more = items.length > 3
      ? `<li style="opacity:.6;">+ ${items.length - 3} de plus → cliquer</li>`
      : '';
    return `
    <div class="phase" onclick="openDetail('phase',${idx})">
      <div class="phase-label">${escapeHtml(p.label)} — ${escapeHtml(p.dates)}</div>
      <div class="phase-title">${escapeHtml(p.title)}</div>
      <div class="phase-desc">${escapeHtml(p.desc)}</div>
      <ul>${head}${more}</ul>
    </div>
  `;
  }).join('');
}

/** DOM mount. */
export function renderPlanView(deps: PlanDeps): void {
  const c = document.getElementById('phasesContainer');
  if (!c) return;
  c.innerHTML = buildPlanView(deps);
}
