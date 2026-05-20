// ============================================================================
// Todos render — barrel. Phase TS-14B.
// ============================================================================
export type {
  TodoEntity, TodoFilterKey, TodoSortKey, TodoProgress, TodoModel, TodoViewResult, TodoDeps,
} from './types';

export {
  computeProgress, countByFilter, applyFilter, applySort, groupByCategory, dueInfo,
} from './calculations';

export { buildFilterChips } from './widgets/filter-chips';
export { buildSortChips, findSortDescriptor, SORT_DESCRIPTORS } from './widgets/sort-chips';
export { buildTodoItem } from './widgets/todo-item';
export { buildSection } from './widgets/section';

export { buildTodosView } from './composition';
export {
  renderTodosView, registerTodosSideEffects, type TodosSideEffects,
} from './mount';
