// ============================================================================
// Team render — types. Phase TS-14D.
// ============================================================================

export interface TeamMember {
  id: string;
  name?: string;
  role?: string;
  note?: string;
  contact?: string;
  [key: string]: unknown;
}

export interface TeamModel {
  members: TeamMember[];
}

export interface TeamViewResult {
  empty: boolean;
  emptyHtml: string;
  listHtml: string;
}

export interface TeamDeps {
  escapeHtml: (s: string | null | undefined) => string;
  icon: (name: string, size?: number, extra?: string) => string;
  emptyState: (kind: string, title: string, hint?: string, ctaLabel?: string, ctaOnclick?: string) => string;
}
