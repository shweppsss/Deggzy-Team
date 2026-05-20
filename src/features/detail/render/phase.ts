// ============================================================================
// Detail renderer — strategic phase kind. Phase TS-7.
// Pure function: (entity, deps, context) => string. No globals, no DOM.
// ============================================================================

import type { RenderDeps } from './shared';

export interface PhaseEntity {
  label?: string;
  dates?: string;
  title?: string;
  desc?: string;
  items?: string[];
}

export interface PhaseRenderContext {
  /** Todos related to this phase (pre-filtered by lifecycle.ts). */
  relatedTodos: Array<{ id: string; text?: string; done?: boolean; urgent?: boolean }>;
}

export function renderPhase(p: PhaseEntity, deps: RenderDeps, ctx: PhaseRenderContext): string {
  const esc = deps.escapeHtml;
  const items = Array.isArray(p.items) ? p.items : [];
  const remaining = ctx.relatedTodos.filter((t) => !t.done).length;

  return `
    <div class="detail-hero">
      <div class="detail-eyebrow">${esc(p.label)} — ${esc(p.dates)}</div>
      <div class="detail-title">${esc(p.title)}</div>
      <div class="detail-tagline">${esc(p.desc)}</div>
    </div>
    <div class="detail-section">
      <h3>Actions de la phase</h3>
      <ul style="padding-left:18px; color: var(--text-soft); font-size: 14px; line-height: 1.8;">
        ${items.map((i) => `<li>${esc(i)}</li>`).join('')}
      </ul>
    </div>
    ${ctx.relatedTodos.length ? `
    <div class="detail-section">
      <h3>Tâches liées (${remaining} à faire / ${ctx.relatedTodos.length} totales)</h3>
      <div class="detail-related">
        ${ctx.relatedTodos.map((t) => `
          <div class="detail-related-card" onclick="openDetail('todo','${t.id}')">
            <div class="detail-related-label">${t.done ? '✓ Terminée' : (t.urgent ? '⚡ Urgent' : 'À faire')}</div>
            <div class="detail-related-title">${esc(t.text)}</div>
          </div>
        `).join('')}
      </div>
    </div>` : ''}
    <div class="detail-actions"><button class="btn btn-primary" data-detail-close>Fermer</button></div>
  `;
}
