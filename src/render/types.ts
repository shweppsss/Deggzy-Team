// ============================================================================
// Render dispatch — types. Phase TS-12.
//
// `SectionId` is the canonical list of render targets. The route names
// (`'calendrier'`, `'equipe'`) are the legacy view-attribute strings the
// nav uses; `'calendar'` / `'team'` are the section ids the realtime
// patcher uses. We keep BOTH because the inline route handler still
// uses the legacy strings — TS-12 only owns the dispatch layer, not
// the route-name unification (TS-13+).
// ============================================================================

/** Section ids — used by the registry + the state-deps map. */
export type SectionId =
  | 'dashboard'
  | 'profile'
  | 'todos'
  | 'catalogue'
  | 'calendar'
  | 'inspirations'
  | 'clips'
  | 'capsules'
  | 'assets'
  | 'team'
  | 'budget'
  | 'plan'
  | 'kpi';

/** Route names — what the nav attribute uses (legacy). */
export type RouteName =
  | 'dashboard'
  | 'profile'
  | 'todos'
  | 'catalogue'
  | 'calendrier'
  | 'inspirations'
  | 'clips'
  | 'capsules'
  | 'assets'
  | 'equipe'
  | 'budget'
  | 'plan'
  | 'kpi';

/** A render function — takes nothing, returns nothing (DOM is a side-effect). */
export type RenderFn = () => void;

/** Options for renderAll / invalidate. */
export interface RenderOpts {
  /** When present, only the listed sections re-render. Empty/missing → full pass. */
  only?: SectionId[];
}
