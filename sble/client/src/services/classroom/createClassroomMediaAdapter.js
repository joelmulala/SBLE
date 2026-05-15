import { createLiveKitClassroomMediaAdapter } from './livekitAdapter';

/**
 * @returns {import('./ClassroomMediaAdapter').ClassroomMediaAdapter}
 */
export function createClassroomMediaAdapter() {
  return createLiveKitClassroomMediaAdapter();
}
