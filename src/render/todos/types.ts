// ============================================================================
// Todos render — types. Phase TS-14B.
// ============================================================================

export interface TodoEntity {
  id: string;
  text?: string;
  done?: boolean;
  urgent?: boolean;
  priority?: string;
  cat?: string;
  due?: string;
  tags?: unknown;
  [key: string]: unknown;
}

export type TodoFilterKey = 'all' | 'urgent' | 'done' | string;
export type TodoSortKey = 'phase' | 'urgent' | 'due-asc' | 'name' | 'recent' | 'done-last';

export interface TodoProgress {
  total: number;
  done: number;
  pct: number;
}

export interface TodoModel {
  todos: TodoEntity[];
  filter: TodoFilterKey;
  sort: TodoSortKey;
  /** Active tag filter (drives the per-todo predicate via deps). */
  tagFilter: unknown;
}

export interface TodoViewResult {
  progressLabel: string;        // "3 / 12"
  progressPercent: string;      // "25 %"
  progressBarPct: number;        // 25
  filterChipsHtml: string;
  sortChipsHtml: string;
  listHtml: string;
  empty: boolean;
}

export interface TodoDeps {
  escapeHtml: (s: string | null | undefined) => string;
  formatDate: (s: string | undefined) => string;
  icon: (name: string, size?: number, extra?: string) => string;
  emptyState: (kind: string, title: string, hint?: string, ctaLabel?: string, ctaOnclick?: string) => string;
  todoPriority: (todo: TodoEntity) => string;
  tagChipsHTML: (tags: unknown, opts?: { limit?: number }) => string;
  /** Tag-filter predicate (uses the active state.tagFilter). */
  entityMatchesTagFilter: (todo: TodoEntity) => boolean;
  /** Readonly tuple of TODO_CATEGORIES. */
  categories: ReadonlyArray<string>;
}
