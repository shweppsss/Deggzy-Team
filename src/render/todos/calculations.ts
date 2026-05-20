// ============================================================================
// Todos render — calculations. Phase TS-14B.
// PURE math / data filtering / sorting. NO DOM, NO state read.
// ============================================================================

import type { TodoEntity, TodoFilterKey, TodoProgress, TodoSortKey, TodoDeps } from './types';

/** Completion progress for the header. */
export function computeProgress(todos: TodoEntity[]): TodoProgress {
  const total = todos.length;
  const done = todos.filter((t) => t.done).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { total, done, pct };
}

/** Count for a given filter chip. */
export function countByFilter(todos: TodoEntity[], filter: TodoFilterKey): number {
  if (filter === 'all') return todos.length;
  if (filter === 'done') return todos.filter((t) => t.done).length;
  if (filter === 'urgent') return todos.filter((t) => t.urgent && !t.done).length;
  return todos.filter((t) => t.cat === filter).length;
}

/** Apply the chip-level filter (does NOT apply the tag filter — that's separate). */
export function applyFilter(todos: TodoEntity[], filter: TodoFilterKey): TodoEntity[] {
  if (filter === 'all') return todos.slice();
  if (filter === 'urgent') return todos.filter((t) => t.urgent && !t.done);
  if (filter === 'done') return todos.filter((t) => t.done);
  return todos.filter((t) => t.cat === filter);
}

/** Sort comparators — pure, stable on ties. */
function urgentCompare(a: TodoEntity, b: TodoEntity): number {
  return ((a.done ? 1 : 0) - (b.done ? 1 : 0))
    || ((b.urgent ? 1 : 0) - (a.urgent ? 1 : 0))
    || (a.due || '9999').localeCompare(b.due || '9999');
}

/** Apply the flat sort (used when sort != 'phase'). Returns a NEW array. */
export function applySort(todos: TodoEntity[], sort: TodoSortKey): TodoEntity[] {
  const list = todos.slice();
  if (sort === 'urgent') {
    list.sort(urgentCompare);
  } else if (sort === 'due-asc') {
    list.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const da = a.due || '9999-12-31';
      const db = b.due || '9999-12-31';
      return da.localeCompare(db);
    });
  } else if (sort === 'name') {
    list.sort((a, b) => (a.text || '').localeCompare(b.text || '', 'fr', { sensitivity: 'base' }));
  } else if (sort === 'recent') {
    list.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
  } else if (sort === 'done-last') {
    list.sort((a, b) =>
      ((a.done ? 1 : 0) - (b.done ? 1 : 0))
        || ((b.urgent ? 1 : 0) - (a.urgent ? 1 : 0)),
    );
  }
  return list;
}

/** Group todos by category. Each group is internally sorted by urgentCompare. */
export function groupByCategory(todos: TodoEntity[], categories: ReadonlyArray<string>): Map<string, TodoEntity[]> {
  const groups = new Map<string, TodoEntity[]>();
  for (const t of todos) {
    const key = t.cat || 'Autre';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  for (const arr of groups.values()) {
    arr.sort(urgentCompare);
  }
  // Restrict to known categories in declared order; preserves the inline shape.
  const ordered = new Map<string, TodoEntity[]>();
  for (const cat of categories) {
    if (groups.has(cat)) ordered.set(cat, groups.get(cat)!);
  }
  return ordered;
}

// ---------------------------------------------------------------------------
// Per-row due-date helpers — used by widgets/todo-item.ts. PURE.
// ---------------------------------------------------------------------------

export interface DueInfo {
  /** CSS class to apply to .list-row-sub: '', 'late', or 'soon'. */
  cls: '' | 'late' | 'soon';
  /** Human label: '' / 'En retard · 12 mai' / 'J-2 · 12 mai' / '12 mai'. */
  label: string;
}

export function dueInfo(t: TodoEntity, today: Date, deps: TodoDeps): DueInfo {
  if (!t.due) return { cls: '', label: '' };
  const base = deps.formatDate(t.due);
  if (t.done) return { cls: '', label: base };
  const d = new Date(t.due);
  const midToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.ceil((d.getTime() - midToday.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { cls: 'late', label: `En retard · ${base}` };
  if (diff <= 3) return { cls: 'soon', label: `J-${diff} · ${base}` };
  return { cls: '', label: base };
}
