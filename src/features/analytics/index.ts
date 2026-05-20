// ============================================================================
// Analytics + monitoring — barrel. Phase Analytics-1.
// ============================================================================

import type { AnalyticsDeps } from './types';
import { registerAnalyticsDeps } from './sink';

export type { AnalyticsEventCategory, AnalyticsEvent, AnalyticsDeps } from './types';
export {
  track, getRecentEvents, countEvents, clearEvents,
  isAnalyticsEnabled, setAnalyticsEnabled,
  _resetAnalytics, _getBufferSize,
} from './sink';
export {
  probeSave, probeAudio, probeRender, probeTracks,
  probeOffline, probeRealtime, probeMobile, probeError,
} from './probes';

/** Wire the analytics sink. Call once at boot. */
export function registerAnalytics(deps: AnalyticsDeps = {}): void {
  registerAnalyticsDeps(deps);
}
