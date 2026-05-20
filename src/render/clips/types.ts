// ============================================================================
// Video-section render (clips / capsules) — types. Phase TS-14C.
//
// Clips and capsules share their render path entirely (renderVideoSection in
// the inline code). This module is shared by both `/src/render/clips/` and
// `/src/render/capsules/` (the latter is a thin TS-14D wrapper).
// ============================================================================

export interface VideoItem {
  id: string;
  title?: string;
  addedAt?: string;
  [key: string]: unknown;
}

export type VideoSectionKind = 'clips' | 'capsules';

export interface VideoSectionConfig {
  /** State key holding the array of items. */
  stateKey: string;
  /** DOM grid container id. */
  gridId: string;
  /** Singular label for the empty-state CTA ("Ajouter un clip"). */
  label: string;
  /** Upload input id triggered by the empty-state CTA. */
  uploadInputId: string;
}

export const VIDEO_CONFIGS: Record<VideoSectionKind, VideoSectionConfig> = {
  clips: {
    stateKey: 'clips',
    gridId: 'clipsGrid',
    label: 'clip',
    uploadInputId: 'clipUpload',
  },
  capsules: {
    stateKey: 'capsules',
    gridId: 'capsulesGrid',
    label: 'capsule',
    uploadInputId: 'capsuleUpload',
  },
};

export interface VideoModel {
  kind: VideoSectionKind;
  items: VideoItem[];
}

export interface VideoViewResult {
  empty: boolean;
  /** Empty-state HTML (when empty). */
  emptyHtml: string;
  /** Cards HTML (when non-empty). */
  gridHtml: string;
  /** CSS selector for hydration — used by mount.ts to fill blob URLs. */
  hydrateSelector: string;
}

export interface VideoDeps {
  escapeHtml: (s: string | null | undefined) => string;
  icon: (name: string, size?: number, extra?: string) => string;
  emptyState: (kind: string, title: string, hint?: string, ctaLabel?: string, ctaOnclick?: string) => string;
}
