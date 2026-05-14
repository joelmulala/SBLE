/**
 * Normalized API error text for course-scoped assessment routes.
 * Prefer server messages except generic enrollment noise, then HTTP status fallbacks.
 */
export function resolveCourseAccessMessage(err, fallback = 'Request failed.') {
  const status = err?.response?.status;
  const backendMessage = err?.response?.data?.error;

  if (backendMessage && backendMessage !== 'Forbidden: not enrolled in this course') {
    return backendMessage;
  }

  if (status === 403) return 'Access denied: you are not enrolled in this course.';
  if (status === 404) return 'This course does not exist or is no longer available.';
  return backendMessage || fallback;
}
