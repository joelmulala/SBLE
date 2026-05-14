/**
 * LiveKit Cloud / self-hosted connection settings (optional until Phase 3+).
 * Secrets must come from environment — never hardcode.
 *
 * Contract: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_WS_URL (wss://… from dashboard).
 * Legacy alias: LIVEKIT_URL is read only if LIVEKIT_WS_URL is unset (same value as Cloud “URL”).
 */

const trim = (v) => String(v || '').trim();

const apiKey = () => trim(process.env.LIVEKIT_API_KEY);
const apiSecret = () => trim(process.env.LIVEKIT_API_SECRET);
const wsUrl = () => trim(process.env.LIVEKIT_WS_URL || process.env.LIVEKIT_URL);

const isLiveKitConfigured = () => Boolean(apiKey() && apiSecret() && wsUrl());

module.exports = {
  apiKey,
  apiSecret,
  wsUrl,
  isLiveKitConfigured
};
