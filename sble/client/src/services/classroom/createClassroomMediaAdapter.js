import { createJitsiClassroomMediaAdapter } from './jitsiAdapter';
import { createLiveKitClassroomMediaAdapter } from './livekitAdapter';

/**
 * @returns {import('./ClassroomMediaAdapter').ClassroomMediaAdapter}
 */
export function createClassroomMediaAdapter() {
  const backend = String(process.env.REACT_APP_CLASSROOM_BACKEND || 'jitsi').toLowerCase();
  if (backend === 'livekit') {
    return createLiveKitClassroomMediaAdapter();
  }
  return createJitsiClassroomMediaAdapter();
}
