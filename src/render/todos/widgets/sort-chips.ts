// ============================================================================
// Todos widget — sort chips. Phase TS-14B. PURE HTML.
// ============================================================================

import type { TodoSortKey } from '../types';

export interface SortDescriptor {
  id: TodoSortKey;
  label: string;
}

/** Sort descriptors in the order they appear in the UI. Stable identity. */
export const SORT_DESCRIPTORS: ReadonlyArray<SortDescriptor> = Object.freeze([
  { id: 'phase',     label: 'Par phase' },
  { id: 'urgent',    label: "Urgent d'abord" },
  { id: 'due-asc',   label: 'Échéance proche' },
  { id: 'done-last', label: 'Faites en dernier' },
  { id: 'recent',    label: 'Récentes' },
  { id: 'name',      label: 'A → Z' },
]);

export function buildSortChips(activeSort: TodoSortKey): string {
  return SORT_DESCRIPTORS.map((s) =>
    `<div class="todo-filter-chip ${activeSort === s.id ? 'active' : ''}" onclick="setTodoSort('${s.id}')">${s.label}</div>`,
  ).join('');
}

export function findSortDescriptor(id: TodoSortKey): SortDescriptor | undefined {
  return SORT_DESCRIPTORS.find((s) => s.id === id);
}
