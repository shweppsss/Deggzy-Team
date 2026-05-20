// ============================================================================
// KPI render — barrel. Phase TS-15.
// ============================================================================

import { escapeHtml } from '../../lib/format-utils';
import { getState } from '../../data';

export interface KpiRow {
  label?: string;
  value?: string;
  target?: string;
}

export interface KpiViewResult {
  html: string;
  empty: boolean;
}

/** PURE — compose the kpi grid. */
export function buildKpiView(rows: KpiRow[]): KpiViewResult {
  if (!Array.isArray(rows) || rows.length === 0) return { html: '', empty: true };
  const html = rows.map((k, i) => `
    <div class="kpi-card">
      <div class="kpi-label">${escapeHtml(k.label)}</div>
      <div class="kpi-value"><input value="${escapeHtml(k.value)}" data-i="${i}" onchange="updateKPI(this, 'value')" /></div>
      <div class="kpi-target">${escapeHtml(k.target)}</div>
    </div>
  `).join('');
  return { html, empty: false };
}

/** DOM mount — reads kpis from state. */
export function renderKpiView(): void {
  const g = document.getElementById('kpiGrid');
  if (!g) return;
  const state = getState() as { kpis?: KpiRow[] };
  const result = buildKpiView(Array.isArray(state.kpis) ? state.kpis : []);
  g.innerHTML = result.html;
}
