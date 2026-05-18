// ============================================================================
// Detail overlay types — Phase TS-6.
//
// Discriminated union of the 6 entity kinds the detail overlay can display.
// Kept intentionally MINIMAL — only the fields lifecycle.ts actually reads.
// HTML composition helpers (detailEventHTML, etc.) remain inline-defined in
// index.html for now; lifecycle.ts calls them through window globals with
// `typeof` guards (TS-7 will move them to a typed render module).
// ============================================================================

export type DetailKind = 'event' | 'track' | 'todo' | 'inspi' | 'member' | 'phase';

// Each entity has at minimum an id. The rest of the shape varies by kind and
// is determined by the inline HTML helper that consumes it.
export interface DetailEvent {
  id: string;
  type?: string;
  [key: string]: unknown;
}

export interface DetailTrack {
  id: string;
  idbAudio?: unknown;
  idbCover?: unknown;
  audio?: string;
  [key: string]: unknown;
}

export interface DetailTodo {
  id: string;
  cat?: string;
  [key: string]: unknown;
}

export interface DetailInspi {
  id: string;
  category?: string;
  [key: string]: unknown;
}

export interface DetailMember {
  id: string;
  [key: string]: unknown;
}

export interface DetailPhase {
  // Phases are looked up via numeric index in `PHASES[id]`, but the id
  // arriving from event handlers is a string — kept loose intentionally.
  [key: string]: unknown;
}

export type DetailEntity =
  | DetailEvent
  | DetailTrack
  | DetailTodo
  | DetailInspi
  | DetailMember
  | DetailPhase;
