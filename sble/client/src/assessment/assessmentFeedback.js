/** Maps user-visible assessment toasts to alert variants. */
export function feedbackAlertType(message) {
  const t = String(message).toLowerCase();
  if (t.includes('failed') || t.includes('denied') || t.includes('access denied')) return 'error';
  if (t.includes('choose') || t.includes('select a file') || t.includes('please enter')) return 'warn';
  return 'success';
}
