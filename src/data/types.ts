// ============================================================================
// Data layer — types. Phase TS-12.
//
// Strict typing for the workspace state shape. Kept LOOSE on the leaves
// because the legacy state stores opaque per-entity records (events,
// tracks, todos, etc.); each domain narrows further when it consumes.
//
// The shape mirrors `DEFAULTS` in the inline code so persistence/merge/
// workspace modules can operate against a single source of truth.
// ============================================================================

/** Minimal entity shape — every domain object has at least an id. */
export interface EntityRow {
  id: string;
  [key: string]: unknown;
}

/** Workspace state — the JSONB blob stored in Supabase + localStorage. */
export interface WorkspaceState {
  user?: { name?: string; role?: string; since?: string } | null;
  events?: EntityRow[];
  todos?: EntityRow[];
  tracks?: EntityRow[];
  inspirations?: EntityRow[];
  clips?: EntityRow[];
  capsules?: EntityRow[];
  assets?: EntityRow[];
  team?: EntityRow[];
  budget?: unknown;
  plan?: unknown;
  kpi?: unknown[];
  streak?: unknown;
  tagFilter?: unknown;
  calMonth?: string;
  calView?: 'month' | 'week' | string;
  calWeekStart?: string;
  // Free-form: legacy fields keep working.
  [key: string]: unknown;
}

/** Supabase `profiles` row — the subset the data layer touches. */
export interface ProfileRow {
  id?: string;
  name?: string;
  role?: string;
  email?: string;
  alias?: string | null;
  [key: string]: unknown;
}

/**
 * Workspace ID arrays — the canonical list of state keys whose items
 * carry a stable `.id` and must merge BY ID rather than by array index.
 *
 * If you add a new entity collection, append it here. Forgetting this
 * means concurrent edits silently overwrite each other.
 */
export const WORKSPACE_ID_ARRAYS = [
  'events',
  'todos',
  'inspirations',
  'team',
  'tracks',
  'clips',
  'capsules',
] as const;

export type WorkspaceIdArrayKey = typeof WORKSPACE_ID_ARRAYS[number];
