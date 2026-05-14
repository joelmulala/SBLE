/** Schema for user text messages on the classroom data channel (distinct from participation `v`). */
export const CHAT_USER_SCHEMA = 2;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const MAX_BODY = 2000;

/**
 * @param {string} s
 * @returns {string}
 */
function sanitizeBody(s) {
  const t = String(s || '').trim().replace(/\u0000/g, '');
  return t.length > MAX_BODY ? t.slice(0, MAX_BODY) : t;
}

/**
 * @param {unknown} role
 * @returns {'lecturer'|'student'|'admin'}
 */
function normalizeRole(role) {
  if (role === 'lecturer' || role === 'admin') return role;
  return 'student';
}

/**
 * @param {Uint8Array} uint8
 * @returns {{ id: string, t: number, identity: string, name: string, role: 'lecturer'|'student'|'admin', body: string } | null}
 */
export function decodeChatUserPayload(uint8) {
  if (!uint8 || !uint8.byteLength) return null;
  try {
    const o = JSON.parse(decoder.decode(uint8));
    if (o.ch !== CHAT_USER_SCHEMA || typeof o.id !== 'string' || !o.id) return null;
    if (typeof o.identity !== 'string' || !o.identity) return null;
    const body = sanitizeBody(o.body);
    if (!body) return null;
    const t = typeof o.t === 'number' && Number.isFinite(o.t) ? o.t : Date.now();
    return {
      id: o.id,
      t,
      identity: String(o.identity),
      name: String(o.name || 'Participant').trim() || 'Participant',
      role: normalizeRole(o.role),
      body
    };
  } catch (_) {
    return null;
  }
}

/**
 * @param {{ id: string, t: number, identity: string, name: string, role: 'lecturer'|'student'|'admin', body: string }} m
 */
export function encodeChatUserPayload(m) {
  return encoder.encode(JSON.stringify({
    ch: CHAT_USER_SCHEMA,
    id: m.id,
    t: m.t,
    identity: m.identity,
    name: m.name,
    role: normalizeRole(m.role),
    body: sanitizeBody(m.body)
  }));
}

export { sanitizeBody };
