// ============================================================================
// Todos render — composition. Phase TS-14B.
// PURE orchestration: (model, deps) → TodoViewResult. NO DOM.
// ============================================================================

import type { TodoDeps, TodoEntity, TodoModel, TodoViewResult } from './types';
import {
  computeProgress,
  applyFilter,
  applySort,
  groupByCategory,
} from './calculations';
import { buildFilterChips } from './widgets/filter-chips';
import { buildSortChips, findSortDescriptor } from './widgets/sort-chips';
import { buildTodoItem } from './widgets/todo-item';
import { buildSection } from './widgets/section';

export function buildTodosView(model: TodoModel, deps: TodoDeps): TodoViewResult {
  const todos = Array.isArray(model.todos) ? model.todos : [];
  const progress = computeProgress(todos);

  const filterChipsHtml = buildFilterChips(todos, model.filter, deps);
  const sortChipsHtml = buildSortChips(model.sort);

  // Apply chip-level filter then tag filter.
  let visible = applyFilter(todos, model.filter);
  if (model.tagFilter) visible = visible.filter(deps.entityMatchesTagFilter);

  const today = new Date();

  let listHtml = '';
  let empty = visible.length === 0;

  if (model.sort === 'phase') {
    const groups = groupByCategory(visible, deps.categories);
    if (groups.size === 0) {
      empty = true;
    } else {
      empty = false;
      for (const [cat, items] of groups.entries()) {
        if (items.length === 0) continue;
        const undone = items.filter((i: TodoEntity) => !i.done).length;
        listHtml += buildSection(
          cat,
          undone,
          items.length,
          items.map((t) => buildTodoItem(t, today, deps)).join(''),
        );
      }
    }
  } else {
    const sorted = applySort(visible, model.sort);
    const desc = findSortDescriptor(model.sort);
    const undone = sorted.filter((t) => !t.done).length;
    listHtml = buildSection(
      desc ? desc.label : 'Trié',
      undone,
      sorted.length,
      sorted.map((t) => buildTodoItem(t, today, deps)).join(''),
    );
    empty = sorted.length === 0;
  }

  return {
    progressLabel: `${progress.done} / ${progress.total}`,
    progressPercent: `${progress.pct} %`,
    progressBarPct: progress.pct,
    filterChipsHtml,
    sortChipsHtml,
    listHtml,
    empty,
  };
}
