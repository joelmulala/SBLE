/** @returns {Element | null} */
export function getFullscreenElement() {
  if (typeof document === 'undefined') return null;
  return (
    document.fullscreenElement
    || document.webkitFullscreenElement
    || document.mozFullScreenElement
    || document.msFullscreenElement
    || null
  );
}

/**
 * @param {Element} el
 * @returns {Promise<void>}
 */
export function requestElementFullscreen(el) {
  const fn = el.requestFullscreen
    || el.webkitRequestFullscreen
    || el.mozRequestFullScreen
    || el.msRequestFullscreen;
  if (!fn) return Promise.reject(new Error('Fullscreen not supported'));
  return Promise.resolve(fn.call(el));
}

/** @returns {Promise<void>} */
export function exitDocumentFullscreen() {
  const fn = document.exitFullscreen
    || document.webkitExitFullscreen
    || document.mozCancelFullScreen
    || document.msExitFullscreen;
  if (!fn) return Promise.reject(new Error('Fullscreen not supported'));
  return Promise.resolve(fn.call(document));
}

/**
 * @param {() => void} onChange
 * @returns {() => void}
 */
export function subscribeFullscreenChange(onChange) {
  const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
  events.forEach((e) => document.addEventListener(e, onChange));
  return () => events.forEach((e) => document.removeEventListener(e, onChange));
}
