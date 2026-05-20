// ============================================================================
// Data layer — merge rules. Phase TS-12.
//
// The merge rules used to live in two inline functions:
//   - `deepMerge(target, source)` — defaults overlay (used on cold load)
//   - `mergeWorkspaceStates(local, cloud)` — concurrent-edit reconciliation
//
// They were SILENT about their contract — arrays overwrote, undefined was
// ignored, nulls were not respected, and a new entity collection slipped
// through the ID_ARRAYS list silently overwrote concurrent edits.
//
// TS-12 makes the contract EXPLICIT:
//
// RULE 1 — Plain objects: deep-merge property by property.
// RULE 2 — Arrays of id-bearing entities (per WORKSPACE_ID_ARRAYS):
//          merge BY ID. Local wins on conflict for `mergeWorkspaceStates`;
//          for `deepMergeWorkspace`, the source (saved) value wins entirely
//          (matches the legacy "user's edits" semantics).
// RULE 3 — Arrays of other shape (kpi, streak.entries, etc.): source value
//          wins entirely. No per-element merge attempted.
// RULE 4 — Primitives + non-array objects: source value overwrites target.
// RULE 5 — `undefined` in source is IGNORED — the target keeps its value.
//          (This preserves legacy semantics: a partial patch doesn't
//          accidentally clear unspecified keys.)
// RULE 6 — `null` in source IS RESPECTED — it represents a deliberate
//          delete intention. The target's value becomes null.
//
// The compiler can't enforce these rules at the type level (state values
// are `unknown`); the harness pins them via SC45 (merge preservation) and
// SC48 (concurrent patch ordering).
// ============================================================================

import { WORKSPACE_ID_ARRAYS, type WorkspaceState, type EntityRow } from './types';

type AnyRecord = Record<string, unknown>;

function isPlainObject(v: unknown): v is AnyRecord {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

const ID_ARRAY_SET: ReadonlySet<string> = new Set(WORKSPACE_ID_ARRAYS);

/**
 * Recursive deep-merge applying the rules above. Mutates `target` and
 * returns it (caller is responsible for cloning if immutability matters).
 *
 * Used by:
 *   - `loadState()` (data/persistence) to overlay the user's saved blob
 *     on top of `DEFAULTS` at cold-load.
 *   - `loadWorkspaceFromCloud()` (data/workspace) to overlay the remote
 *     blob on `DEFAULTS` after a fresh fetch.
 */
export function deepMergeWorkspace(target: AnyRecord, source: unknown): AnyRecord {
  if (!isPlainObject(source)) return target;
  for (const k of Object.keys(source)) {
    const sv = source[k];
    // RULE 5 — undefined skipped
    if (typeof sv === 'undefined') continue;
    // RULE 1 — plain objects: recurse
    if (isPlainObject(sv)) {
      const tv = target[k];
      target[k] = deepMergeWorkspace(isPlainObject(tv) ? tv : {}, sv);
      continue;
    }
    // RULES 2/3/4/6 — arrays + primitives + null: source wins as-is.
    // (For deepMergeWorkspace, even id-arrays get replaced wholesale —
    //  the "user's edits" semantics from the inline original. The BY-ID
    //  merge is reserved for mergeWorkspaceStates below.)
    target[k] = sv;
  }
  return target;
}

/**
 * Merge two workspace snapshots by ID on id-bearing arrays. Used when
 * a concurrent cloud edit is detected before we push: we keep BOTH
 * sides' items rather than overwriting. Local wins on per-id conflicts.
 *
 * Deletes can "resurrect" if the other side still has the item — known
 * limitation of the monolith JSONB approach (carried over from inline).
 */
export function mergeWorkspaceStates(local: WorkspaceState | null | undefined, cloud: WorkspaceState | null | undefined): WorkspaceState {
  if (!cloud || typeof cloud !== 'object') return (local || {}) as WorkspaceState;
  if (!local || typeof local !== 'object') return cloud;
  // Start from a deep clone of local so mutations don't escape.
  const merged: AnyRecord = JSON.parse(JSON.stringify(local));
  for (const key of WORKSPACE_ID_ARRAYS) {
    const localArr: EntityRow[] = Array.isArray((local as AnyRecord)[key]) ? ((local as AnyRecord)[key] as EntityRow[]) : [];
    const cloudArr: EntityRow[] = Array.isArray((cloud as AnyRecord)[key]) ? ((cloud as AnyRecord)[key] as EntityRow[]) : [];
    const byId = new Map<string, EntityRow>();
    cloudArr.forEach((it) => { if (it && it.id) byId.set(it.id, it); });
    localArr.forEach((it) => { if (it && it.id) byId.set(it.id, it); });
    merged[key] = Array.from(byId.values());
  }
  return merged as WorkspaceState;
}

/**
 * Apply a partial PATCH to a workspace state, returning a NEW object
 * (immutable update — caller's input is not mutated). Honors all rules:
 * id-arrays merge by id, primitives overwrite, undefined skips, null
 * deletes.
 *
 * Used by domain mutations that change a small slice of state without
 * needing to reach for the full deep-merge.
 */
export function patchWorkspace(current: WorkspaceState, patch: Partial<WorkspaceState>): WorkspaceState {
  const next: AnyRecord = JSON.parse(JSON.stringify(current));
  const p = patch as AnyRecord;
  for (const k of Object.keys(p)) {
    const pv = p[k];
    if (typeof pv === 'undefined') continue; // RULE 5
    // RULE 2 — id-array merge by id
    if (Array.isArray(pv) && ID_ARRAY_SET.has(k)) {
      const cur: EntityRow[] = Array.isArray(next[k]) ? (next[k] as EntityRow[]) : [];
      const byId = new Map<string, EntityRow>();
      cur.forEach((it) => { if (it && it.id) byId.set(it.id, it); });
      (pv as EntityRow[]).forEach((it) => { if (it && it.id) byId.set(it.id, it); });
      next[k] = Array.from(byId.values());
      continue;
    }
    // RULE 1 — plain objects: deep merge into next[k]
    if (isPlainObject(pv)) {
      const cur = next[k];
      next[k] = deepMergeWorkspace(isPlainObject(cur) ? cur : {}, pv);
      continue;
    }
    // RULES 3/4/6 — replace as-is.
    next[k] = pv;
  }
  return next as WorkspaceState;
}
