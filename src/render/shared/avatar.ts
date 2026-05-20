// ============================================================================
// Render shared — avatar HTML wrapper. Phase TS-13C.
//
// Tiny re-export so calendar renderers import "avatar HTML from a render
// helper" rather than from a feature-specific path. The actual avatar
// implementation lives in /src/features/detail/event-actor.ts (TS-8).
// ============================================================================

export { eventActorAvatarHTML, type Actor } from '../../features/detail/event-actor';
