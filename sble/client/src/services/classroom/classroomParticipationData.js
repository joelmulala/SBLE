/** @typedef {'understood' | 'agree' | 'listening' | 'ready'} ParticipationAckKind */

export const PARTICIPATION_SCHEMA = 1;

/** How long an acknowledgement stays visible (ms). */
export const ACK_DISPLAY_MS = 8000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * @param {Uint8Array} uint8
 * @returns {{ identity: string, raisedHand: boolean, hasQuestion: boolean, ack: ParticipationAckKind|null, ackTs: number|null } | null}
 */
export function decodeParticipationPayload(uint8) {
  if (!uint8 || !uint8.byteLength) return null;
  try {
    const o = JSON.parse(decoder.decode(uint8));
    if (o.v !== PARTICIPATION_SCHEMA || !o.identity) return null;
    const rawAck = o.ack;
    let ack = null;
    if (rawAck === 'understood' || rawAck === 'agree') ack = rawAck;
    else if (rawAck === 'listening' || rawAck === 'ready') ack = 'listening';
    return {
      identity: String(o.identity),
      raisedHand: Boolean(o.raisedHand),
      hasQuestion: Boolean(o.hasQuestion),
      ack,
      ackTs: typeof o.ackTs === 'number' && Number.isFinite(o.ackTs) ? o.ackTs : null
    };
  } catch (_) {
    return null;
  }
}

/**
 * @param {{ identity: string, raisedHand: boolean, hasQuestion: boolean, ack: ParticipationAckKind|null, ackTs: number|null }} state
 */
export function encodeParticipationPayload(state) {
  const ackWire = state.ack === 'listening' ? 'listening' : state.ack || null;
  return encoder.encode(JSON.stringify({
    v: PARTICIPATION_SCHEMA,
    identity: state.identity,
    raisedHand: Boolean(state.raisedHand),
    hasQuestion: Boolean(state.hasQuestion),
    ack: ackWire,
    ackTs: state.ackTs ?? null
  }));
}
