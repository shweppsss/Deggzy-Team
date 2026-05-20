// ============================================================================
// Budget widget — splits table (per track). Phase TS-15. PURE HTML.
// ============================================================================

import { escapeHtml } from '../../../lib/format-utils';
import { splitTotal } from '../calculations';
import type { BudgetDeps, BudgetTrack, SplitContrib } from '../types';

export function buildBudgetSplits(tracks: BudgetTrack[], deps: BudgetDeps): string {
  const intro = `<div style="font-size: 12px; color: var(--text-soft); margin-bottom: 12px;">Définis qui touche quoi sur chaque morceau. Ajoute autant de contributeurs que tu veux (manager, investisseur, beatmaker, topliner...). Le total doit faire <strong>100 %</strong> pour chaque morceau.</div>`;
  const tracksHtml = tracks.map((tr) => {
    const arr: SplitContrib[] = deps.getSplitsForTrack(tr.id) || [];
    const total = splitTotal(arr);
    return `
      <div class="split-card" data-id="${tr.id}">
        <div class="split-card-head">
          <div class="split-card-name">${escapeHtml(tr.name)}</div>
          <div class="split-card-total ${total === 100 ? 'valid' : 'invalid'}">${total}%</div>
        </div>
        <div class="split-contribs">
          ${arr.map((c) => `
            <div class="split-contrib" data-id="${c.id}">
              <input class="split-name" value="${escapeHtml(c.name || '')}" placeholder="Nom (ex: Degzzy)" onchange="updateSplitContrib('${tr.id}','${c.id}','name',this.value)" />
              <select class="split-role" onchange="updateSplitContrib('${tr.id}','${c.id}','role',this.value)">
                ${deps.splitRoles.map((r) => `<option ${c.role === r ? 'selected' : ''}>${escapeHtml(r)}</option>`).join('')}
              </select>
              <input class="split-pct" type="number" min="0" max="100" value="${Number(c.pct) || 0}" onchange="updateSplitContrib('${tr.id}','${c.id}','pct',this.value)" />
              <span class="split-pct-sign">%</span>
              <button class="split-del" onclick="removeSplitContrib('${tr.id}','${c.id}')" title="Retirer" aria-label="Retirer le contributeur" type="button">×</button>
            </div>
          `).join('')}
        </div>
        <button class="split-add" onclick="addSplitContrib('${tr.id}')">+ Ajouter un contributeur (manager, investisseur, beatmaker...)</button>
      </div>
    `;
  }).join('');
  return intro + tracksHtml;
}
