// ============================================================================
// Detail domain — typed constants + small business helpers. Phase TS-8.
//
// Extracted from inline <script> in index.html to a typed TS module. These
// are the domain-specific labels, kind unions, priority levels, and small
// transformations the detail renderers depend on.
//
// DESIGN RULES (non-negotiable):
// - Readonly constants — frozen at module load. No mutation, no side effects.
// - Unions derived from the constants where possible (e.g. EventType).
// - Pure helpers only. No state, no DOM, no window access.
// - Tolerant inputs: unknown / falsy inputs degrade to safe defaults.
// ============================================================================

// ---------------------------------------------------------------------------
// EVENT TYPES + label lookup
// ---------------------------------------------------------------------------

export const EVENT_TYPES = [
  'release',
  'tiktok',
  'instagram',
  'shoot',
  'studio',
  'meeting',
  'interview',
  'call',
  'podcast',
  'listening',
  'milestone',
  'other',
] as const;

export type EventType = typeof EVENT_TYPES[number];

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  release: 'Sortie',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  shoot: 'Shoot',
  studio: 'Studio',
  meeting: 'Meeting',
  interview: 'Interview',
  call: 'Call',
  podcast: 'Podcast',
  listening: 'Listening',
  milestone: 'Jalon',
  other: 'Autre',
};

/** Human label for an event type. Unknown input → echoes input as string. */
export function typeLabel(t: string | null | undefined): string {
  if (t == null) return '';
  return (EVENT_TYPE_LABELS as Record<string, string>)[t] || String(t);
}

// ---------------------------------------------------------------------------
// TRACK STATUS + label lookup
// ---------------------------------------------------------------------------

const TRACK_STATUS_LABELS: Record<string, string> = {
  single: 'Single hors-projet',
  projet: 'Sur le projet',
  produit: 'Produit',
  mixe: 'Mixé',
  masterise: 'Masterisé',
  sorti: 'Sorti',
};

/** Human label for a track status. Unknown input → echoes input as string. */
export function statusLabel(s: string | null | undefined): string {
  if (s == null) return '';
  return TRACK_STATUS_LABELS[s] || String(s);
}

// ---------------------------------------------------------------------------
// TODO categories + priority
// ---------------------------------------------------------------------------

export const TODO_CATEGORIES = [
  'Pre-Launch',
  'Rollout',
  'Pivot',
  'Élévation',
  'Événement',
  'Autre',
] as const;

export type TodoCategory = typeof TODO_CATEGORIES[number];

export const PRIORITY_KEYS = ['critique', 'urgent', 'important', 'normal'] as const;
export type Priority = typeof PRIORITY_KEYS[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  critique: '⛔ Critique',
  urgent: '⚡ Urgent',
  important: '◇ Important',
  normal: 'Normal',
};

interface TodoLike {
  priority?: unknown;
  urgent?: unknown;
}

/**
 * Resolve a todo's priority. If `t.priority` is one of the canonical
 * keys, return it. Otherwise fall back to the legacy `urgent: true`
 * boolean → 'urgent', everything else → 'normal'.
 */
export function todoPriority(t: TodoLike | null | undefined): Priority {
  if (!t) return 'normal';
  const p = t.priority;
  if (typeof p === 'string' && (PRIORITY_KEYS as readonly string[]).includes(p)) {
    return p as Priority;
  }
  return t.urgent === true ? 'urgent' : 'normal';
}

// ---------------------------------------------------------------------------
// Tags — array <-> input value
// ---------------------------------------------------------------------------

/** Compose tags array back to a comma-separated string for display in inputs. */
export function tagsToInput(arr: unknown): string {
  return Array.isArray(arr) ? arr.join(', ') : '';
}

// ---------------------------------------------------------------------------
// Suggested checklist per event type — pure lookup
// ---------------------------------------------------------------------------

const CHECKLISTS: Record<string, string[]> = {
  release: [
    'Cover prête et uploadée sur le distributeur',
    'Pre-save activé J-14',
    'Visualizer prêt (vertical + horizontal)',
    'Snippet teaser publié J-7',
    'Post IG officiel + reel le jour J',
    "TikTok face cam « c'est sorti » le jour J",
    '3-4 contenus secondaires sur J+1 à J+7',
  ],
  tiktok: [
    'Hook fort dans les 3 premières secondes',
    "Texte à l'écran (caption)",
    'Sound original poussé',
    'Format vertical 9:16',
    'Heure de pub : 18h-21h en semaine',
  ],
  instagram: [
    'Cohérence avec la charte visuelle',
    'Caption travaillée + 3-5 hashtags max',
    'Story relais + countdown si pertinent',
    'Tag des collaborateurs (vidéaste, DA, photographe)',
  ],
  shoot: [
    'Briefer photographe / vidéaste 48h avant',
    'Repérage / moodboard validé',
    'Wardrobe préparé',
    'Plan de prise de vue',
    'Backup HDD prévu',
  ],
  studio: [
    'Beat / instru validés',
    'Voix / textes prêts',
    'Cabine réservée',
    'Ingé son confirmé',
    'Backup du projet en fin de session',
  ],
  meeting: [
    'Ordre du jour préparé',
    'Documents / pitch en pièces jointes',
    'Confirmer 24h avant',
    'Définir les next steps avant de partir',
    'Prendre des notes / compte-rendu',
  ],
  interview: [
    'Brief sur le média / journaliste',
    'Anecdotes / punchlines à raconter prêtes',
    'Tenue + look check',
    'Arriver 15 min avant',
    'Confirmer date de publication',
  ],
  call: [
    "Définir l'objectif en 1 phrase",
    'Préparer 2-3 questions clés',
    'Bloquer 30 min calmes',
    'Envoyer le récap par écrit après',
  ],
  podcast: [
    'Écouter 1 épisode pour le ton',
    'Préparer 3 sujets forts',
    'Tenue audio cohérente (pas trop de bruits parasites)',
    'Demander la date de diffusion',
    'Préparer un teaser pour repost',
  ],
  listening: [
    'Sélection morceaux finalisée',
    'Setup son testé (bonne enceinte / casque)',
    'Invitations envoyées',
    'Boisson / ambiance prévues',
    'Recueillir les retours à chaud',
  ],
  milestone: [
    'Communication équipe',
    'Update du dashboard',
    'Activer la suite des actions liées',
  ],
  other: ['À détailler dans les notes'],
};

/** Pre-baked checklist of TODOs for a given event type. Unknown → 'other'. */
export function suggestChecklist(type: string | null | undefined): string[] {
  if (type == null) return CHECKLISTS.other;
  return CHECKLISTS[type] || CHECKLISTS.other;
}
