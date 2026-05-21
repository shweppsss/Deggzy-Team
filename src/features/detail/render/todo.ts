// ============================================================================
// Detail renderer — todo kind. Phase TS-7.
// Pure function: (entity, deps) => string. No globals, no DOM.
// ============================================================================

import type { RenderDeps } from './shared';

export interface TodoEntity {
  id: string;
  text?: string;
  cat?: string;
  done?: boolean;
  due?: string;
  tags?: unknown;
  notes?: string;
  priority?: string;
  urgent?: boolean;
}

export function renderTodo(t: TodoEntity, deps: RenderDeps): string {
  const esc = deps.escapeHtml;
  const priority = deps.todoPriority(t);
  const priorityLabel = deps.priorityLabels[priority] || priority;

  return `
    <div class="detail-hero">
      <div class="detail-eyebrow">${esc(t.cat)} · <span class="priority-pill" data-priority="${priority}">${esc(priorityLabel)}</span>${t.done ? ' · ✓ Terminée' : ''}</div>
      <div class="detail-title" contenteditable="true" onblur="updateTodoField('${t.id}','text',this.innerText)">${esc(t.text)}</div>
    </div>

    <div class="detail-section">
      <h3>Paramètres</h3>
      <div class="detail-grid-3col-equal">
        <div class="detail-field"><label>Catégorie</label>
          <select onchange="updateTodoField('${t.id}','cat',this.value)">
            ${deps.todoCategories.map((c) => `<option ${t.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
          </select>
        </div>
        <div class="detail-field"><label>Priorité</label>
          <select onchange="updateTodoPriority('${t.id}',this.value)">
            ${deps.priorityKeys.map((p) => `<option value="${p}" ${priority === p ? 'selected' : ''}>${esc(deps.priorityLabels[p])}</option>`).join('')}
          </select>
        </div>
        <div class="detail-field"><label>Échéance</label><input type="date" value="${t.due || ''}" onchange="updateTodoField('${t.id}','due',this.value)" /></div>
      </div>
      <div class="detail-field"><label>Tags <span class="profile-field-hint">séparés par virgule</span></label><input value="${esc(deps.tagsToInput(t.tags))}" onblur="updateTodoTags('${t.id}', this.value)" placeholder="ex: rich, single" /></div>
      <div class="detail-field"><label>Notes (optionnel)</label><textarea onblur="updateTodoField('${t.id}','notes',this.value)">${esc(t.notes || '')}</textarea></div>
    </div>

    <div class="detail-actions">
      <button class="btn ${t.done ? '' : 'btn-primary'}" onclick="toggleTodo('${t.id}'); closeDetail();">${t.done ? 'Marquer non faite' : '✓ Marquer faite'}</button>
      <button class="btn btn-danger" onclick="deleteTodo('${t.id}'); closeDetail();">Supprimer</button>
    </div>
  `;
}
