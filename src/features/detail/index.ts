// ============================================================================
// Detail overlay — public barrel. Phase TS-6.
//
// Re-exports the lifecycle surface that other modules import. The hydrate
// helpers are NOT re-exported here — they're internal to the lifecycle
// path and shouldn't be called directly from elsewhere.
//
// `bindDetailClose` is re-exported because some inline call sites may
// invoke it after late renders (the typeof check in the original inline
// code suggests this).
// ============================================================================

export type { DetailKind, DetailEntity } from './types';
export { openDetail, closeDetail, bindDetailClose } from './lifecycle';
