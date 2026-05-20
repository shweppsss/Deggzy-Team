// ============================================================================
// Todos widget — filter chips. Phase TS-14B. PURE HTML.
// ============================================================================

import type { TodoDeps, TodoEntity, TodoFilterKey } from '../types';
import { countByFilter } from '../calculations';

const LABELS: Record<string, string> = { all: 'Toutes', urgent: 'Urgent', done: 'Terminées' };

export function buildFilterChips(todos: TodoEntity[], activeFilter: TodoFilterKey, deps: TodoDeps): string {
  const filters: TodoFilterKey[] = ['all', ...deps.categories, 'urgent', 'done'];
  return filters.map((f) => {
    const label = LABELS[f] || f;
    const count = countByFilter(todos, f);
    return `<div class="todo-filter-chip ${activeFilter === f ? 'active' : ''}" onclick="setTodoFilter('${f}')">${label} <span style="opacity:.6">· ${count}</span></div>`;
  }).join('');
}
