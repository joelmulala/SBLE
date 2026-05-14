/** @typedef {{ id: string, t: number, body: string, kind: 'system' }} ClassroomChatSystemMessage */

/** @typedef {import('./ClassroomMediaAdapter').ClassroomChatUserMessage | ClassroomChatSystemMessage} ClassroomChatRow */

export const MAX_CLASSROOM_CHAT_MESSAGES = 500;

/**
 * Merge by `id`, sort by `t` then `id`, cap length.
 * @param {ClassroomChatRow[]} prev
 * @param {ClassroomChatRow[]} incoming
 * @returns {ClassroomChatRow[]}
 */
export function mergeChatMessages(prev, incoming) {
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) {
    if (!m || typeof m.id !== 'string' || !m.id) continue;
    byId.set(m.id, m);
  }
  const next = Array.from(byId.values());
  next.sort((a, b) => (a.t - b.t) || String(a.id).localeCompare(String(b.id)));
  if (next.length > MAX_CLASSROOM_CHAT_MESSAGES) {
    return next.slice(-MAX_CLASSROOM_CHAT_MESSAGES);
  }
  return next;
}
