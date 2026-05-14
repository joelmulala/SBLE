/** Classroom moderation & requests on LiveKit data channel (distinct from chat `ch:2` and participation `v:1`). */
export const MODERATION_CHANNEL = 4;
export const SESSION_CHANNEL = 5;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * @param {Uint8Array} uint8
 * @returns {{ kind: 'presentation'|'speaking'|'cancel', id: string, actor: string, t: number } | null}
 */
export function decodeModerationRequest(uint8) {
  if (!uint8?.byteLength) return null;
  try {
    const o = JSON.parse(decoder.decode(uint8));
    if (o.ch !== MODERATION_CHANNEL || o.v !== 1 || o.t !== 'req') return null;
    const kind = o.kind === 'presentation' || o.kind === 'speaking' || o.kind === 'cancel' ? o.kind : null;
    if (!kind || typeof o.actor !== 'string' || !o.actor) return null;
    const id = typeof o.id === 'string' && o.id ? o.id : `r-${Date.now()}`;
    const t = typeof o.ts === 'number' && Number.isFinite(o.ts) ? o.ts : Date.now();
    return { kind, id, actor: o.actor, t };
  } catch (_) {
    return null;
  }
}

/**
 * @param {{ kind: 'presentation'|'speaking'|'cancel', id: string, actor: string, ts?: number }} m
 */
export function encodeModerationRequest(m) {
  return encoder.encode(JSON.stringify({
    ch: MODERATION_CHANNEL,
    v: 1,
    t: 'req',
    kind: m.kind,
    id: m.id,
    actor: m.actor,
    ts: m.ts ?? Date.now()
  }));
}

/**
 * @param {Uint8Array} uint8
 * @returns {{ requestId: string, decision: 'approve'|'reject', moderator: string, kind?: string } | null}
 */
export function decodeModerationDecision(uint8) {
  if (!uint8?.byteLength) return null;
  try {
    const o = JSON.parse(decoder.decode(uint8));
    if (o.ch !== MODERATION_CHANNEL || o.v !== 1 || o.t !== 'dec') return null;
    if (typeof o.requestId !== 'string' || !o.requestId) return null;
    if (o.decision !== 'approve' && o.decision !== 'reject') return null;
    if (typeof o.moderator !== 'string' || !o.moderator) return null;
    return {
      requestId: o.requestId,
      decision: o.decision,
      moderator: o.moderator,
      kind: o.kind === 'presentation' || o.kind === 'speaking' ? o.kind : undefined,
      target: typeof o.target === 'string' ? o.target : undefined
    };
  } catch (_) {
    return null;
  }
}

/**
 * @param {{ requestId: string, decision: 'approve'|'reject', moderator: string, kind?: string, target?: string }} m
 */
export function encodeModerationDecision(m) {
  return encoder.encode(JSON.stringify({
    ch: MODERATION_CHANNEL,
    v: 1,
    t: 'dec',
    requestId: m.requestId,
    decision: m.decision,
    moderator: m.moderator,
    kind: m.kind,
    target: m.target
  }));
}

/**
 * @param {Uint8Array} uint8
 * @returns {{ participationLocked: boolean, actor: string } | null}
 */
export function decodeSessionControl(uint8) {
  if (!uint8?.byteLength) return null;
  try {
    const o = JSON.parse(decoder.decode(uint8));
    if (o.ch !== SESSION_CHANNEL || o.v !== 1) return null;
    if (typeof o.actor !== 'string' || !o.actor) return null;
    return {
      participationLocked: Boolean(o.participationLocked),
      actor: o.actor
    };
  } catch (_) {
    return null;
  }
}

/**
 * @param {{ participationLocked: boolean, actor: string }} m
 */
export function encodeSessionControl(m) {
  return encoder.encode(JSON.stringify({
    ch: SESSION_CHANNEL,
    v: 1,
    participationLocked: Boolean(m.participationLocked),
    actor: m.actor
  }));
}
