// ============================================================================
// Todos render — DOM mounting. Phase TS-14B.
// ONLY file in /src/render/todos/** that talks to the DOM.
// ============================================================================

import { getState } from '../../data';
import type { TodoDeps, TodoEntity, TodoFilterKey, TodoModel, TodoSortKey } from './types';
import { buildTodosView } from './composition';

export interface TodosSideEffects {
  /** Attach swipe-to-delete to a row. */
  attachSwipeDelete?: (el: HTMLElement, onDelete: () => void) => void;
  /** Delete a todo by id (called from the swipe handler). */
  swipeDeleteTodo?: (id: string) => void;
  /** Empty-state CTA for "addTodo()" (still inline). */
  addTodo?: () => void;
}

let _fx: TodosSideEffects = {};

export function registerTodosSideEffects(hooks: TodosSideEffects): void {
  _fx = { ..._fx, ...hooks };
}

interface StateSlice {
  todos?: TodoEntity[];
  todoFilter?: TodoFilterKey;
  todoSort?: TodoSortKey;
  tagFilter?: unknown;
}

export function renderTodosView(deps: TodoDeps): void {
  const state = getState() as StateSlice;
  const model: TodoModel = {
    todos: Array.isArray(state.todos) ? state.todos : [],
    filter: state.todoFilter || 'all',
    sort: state.todoSort || 'phase',
    tagFilter: state.tagFilter,
  };
  const result = buildTodosView(model, deps);

  // Progress
  const progressValue = document.getElementById('progressValue');
  if (progressValue) progressValue.textContent = result.progressLabel;
  const progressPercent = document.getElementById('progressPercent');
  if (progressPercent) progressPercent.textContent = result.progressPercent;
  // Delay the bar animation slightly so it transitions from 0.
  setTimeout(() => {
    const bar = document.getElementById('progressBar') as HTMLElement | null;
    if (bar) bar.style.width = result.progressBarPct + '%';
  }, 80);

  // Chips
  const filterEl = document.getElementById('todoFilter');
  if (filterEl) filterEl.innerHTML = result.filterChipsHtml;
  const sortEl = document.getElementById('todoSort');
  if (sortEl) sortEl.innerHTML = result.sortChipsHtml;

  // List body — show empty-state when the post-filter list is empty
  const listsEl = document.getElementById('todoLists');
  if (listsEl) {
    if (result.empty) {
      listsEl.innerHTML = deps.emptyState(
        'todos',
        'Aucune tâche ici',
        'Soit tout est fait, soit le filtre est trop strict. Crée-en une avec le bouton +.',
        'Nouvelle tâche',
        'addTodo()',
      );
    } else {
      listsEl.innerHTML = result.listHtml;
    }
  }

  // Swipe-to-delete on each rendered row
  if (_fx.attachSwipeDelete && _fx.swipeDeleteTodo) {
    document.querySelectorAll<HTMLElement>('#todoLists .list-row[data-id]').forEach((el) => {
      const id = el.dataset.id;
      if (id) _fx.attachSwipeDelete!(el, () => _fx.swipeDeleteTodo!(id));
    });
  }
}
