// ============================================================================
// Data layer — barrel. Phase TS-12.
// ============================================================================

export type { EntityRow, WorkspaceState, ProfileRow, WorkspaceIdArrayKey } from './types';
export { WORKSPACE_ID_ARRAYS } from './types';

export { deepMergeWorkspace, mergeWorkspaceStates, patchWorkspace } from './merge';

export {
  workspaceKey,
  loadStateFromLocal,
  persistStateToLocal,
  clearLocalWorkspace,
} from './persistence';

export {
  setWorkspaceDefaults,
  getWorkspaceDefaults,
  getState,
  setState,
  hydrateStateFromLocal,
  patchState,
  setSupabaseDataClient,
  getLastRemoteUpdatedAt,
  loadWorkspace,
  saveWorkspace,
  registerCloudPushHook,
  _setOnSaveSuccess,
  _cancelPendingSave,
} from './workspace';

export {
  setSupabaseProfilesClient,
  loadProfile,
  ensureProfileExists,
  saveAlias,
} from './profiles';
