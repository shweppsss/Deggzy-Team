// ============================================================================
// Budget widget — transactions table. Phase TS-15. PURE HTML.
// ============================================================================

import { escapeHtml } from '../../../lib/format-utils';
import type { BudgetTransaction } from '../types';

export function buildBudgetTransactions(txs: BudgetTransaction[], categories: ReadonlyArray<string>): string {
  let html = `<div class="tx-item tx-head">
    <div>Date</div><div>Libellé</div><div class="tx-item-cat-col">Catégorie</div><div style="text-align:right;">Montant</div><div></div>
  </div>`;
  if (!txs || txs.length === 0) {
    return html + '<div class="empty" style="border:none;">Aucune dépense. Clique sur + Dépense pour ajouter.</div>';
  }
  html += txs.map((t) => `
    <div class="tx-item" data-id="${t.id}">
      <input type="date" value="${escapeHtml(t.date)}" onchange="updateTx('${t.id}','date',this.value)" />
      <input value="${escapeHtml(t.label)}" onchange="updateTx('${t.id}','label',this.value)" />
      <select class="tx-item-cat-col" onchange="updateTx('${t.id}','cat',this.value)">
        ${categories.map((c) => `<option ${t.cat === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
      </select>
      <input class="tx-amount" type="number" value="${escapeHtml(String(t.amount))}" onchange="updateTx('${t.id}','amount',this.value)" />
      <button class="tx-del" onclick="deleteTx('${t.id}')" aria-label="Supprimer la transaction" type="button">×</button>
    </div>
  `).join('');
  return html;
}
