// ============================================================================
// Detail — event actor avatar helpers. Phase TS-8.
//
// Extracted from inline `_actorInitial` / `_actorColor` / `_eventActorAvatarHTML`
// in index.html. Pure functions: given an actor object, produce either a
// label (initial), a stable color, or the avatar HTML pill.
//
// Used by the event detail renderer for the "Créé par" / "Modifié par"
// credit block.
// ============================================================================

import { escapeHtml } from '../../lib/format-utils';

export interface Actor {
  id?: string;
  name?: string;
}

/** Single uppercase initial from an actor's name. '?' if unavailable. */
export function actorInitial(actor: Actor | null | undefined): string {
  if (!actor || !actor.name) return '?';
  return actor.name.trim().charAt(0).toUpperCase() || '?';
}

/**
 * Stable HSL color string for an actor — same actor always gets the same
 * color across reloads. Hash → 0-359 hue, fixed S/L for legibility on the
 * dark surface palette.
 */
export function actorColor(actor: Actor | null | undefined): string {
  const seed = (actor && actor.id) || (actor && actor.name) || 'anon';
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h * 33) ^ seed.charCodeAt(i)) >>> 0;
  }
  return 'hsl(' + (h % 360) + ', 62%, 55%)';
}

/**
 * HTML for the small circular avatar with the user's first initial.
 * `extraClass` lets the caller tag it with a size variant.
 *
 * data-actor-id powers `upgradeEventAvatars()`: after render the async
 * pass replaces the initial+colour background with the user's photo when
 * one is cached in IDB. The initial stays as the immediate, sync render.
 */
export function eventActorAvatarHTML(actor: Actor | null | undefined, extraClass: string): string {
  if (!actor) return '';
  const initial = actorInitial(actor);
  const color = actorColor(actor);
  const cls = 'cal-event-avatar' + (extraClass ? ' ' + extraClass : '');
  const title = actor.name ? escapeHtml(actor.name) : '';
  const actorId = actor.id ? escapeHtml(actor.id) : '';
  return `<span class="${cls}" data-actor-id="${actorId}" style="background:${color}" title="${title}">${escapeHtml(initial)}</span>`;
}
