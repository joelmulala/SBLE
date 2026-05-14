import axios from 'axios';

const DEFAULT_API_BASE = 'http://localhost:5000/api';

/**
 * Resolve CRA `REACT_APP_API_URL` to the Express `/api` root.
 * - Appends `/api` when the env is only an origin (or non-/api path).
 * - If the value already contains an `/api` path segment (e.g. `.../api/rooms` by mistake),
 *   collapses to `.../api` so requests stay `.../api/rooms/create` instead of `.../api/rooms/api/...` (404).
 */
const normalizeApiBaseUrl = (value) => {
  const raw = String(value || '').trim().replace(/^\uFEFF/, '');
  if (!raw) return DEFAULT_API_BASE;

  const noTrail = raw.replace(/\/+$/, '');
  if (/\/api$/i.test(noTrail)) return noTrail;

  try {
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(noTrail);
    const u = new URL(hasScheme ? noTrail : `http://${noTrail}`);
    const parts = u.pathname.split('/').filter(Boolean);
    const apiIdx = parts.findIndex((p) => p.toLowerCase() === 'api');
    if (apiIdx !== -1) {
      const rootPath = `/${parts.slice(0, apiIdx + 1).join('/')}`;
      const collapsed = `${u.origin}${rootPath}`.replace(/\/+$/, '');
      return collapsed || DEFAULT_API_BASE;
    }
  } catch (_) {
    /* fall through */
  }

  return `${noTrail}/api`;
};

const API_BASE_URL = normalizeApiBaseUrl(process.env.REACT_APP_API_URL);
const TOKEN_STORAGE_KEY = 'sbleToken';

const api = axios.create({
  baseURL: API_BASE_URL
});

// Attach bearer token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const payload = response?.data;

    if (
      payload
      && typeof payload === 'object'
      && Object.prototype.hasOwnProperty.call(payload, 'success')
      && Object.prototype.hasOwnProperty.call(payload, 'data')
    ) {
      // Preserve the full envelope for diagnostics while returning
      // the original route payload shape to existing pages.
      response.envelope = payload;
      response.data = payload.data;
    }

    return response;
  },
  (error) => {
    const status = error?.response?.status;
    const apiMessage = error?.response?.data?.message || error?.response?.data?.error;
    const fallbackMessage = error?.message === 'Network Error'
      ? 'Unable to reach the server. Please check your connection and try again.'
      : (error?.message || 'Request failed');

    const resolvedMessage = apiMessage || fallbackMessage;
    error.userMessage = resolvedMessage;
    error.message = resolvedMessage;

    if (!error.response) {
      error.response = {
        status: 0,
        data: {
          success: false,
          message: resolvedMessage,
          error: resolvedMessage
        }
      };
    }

    if (status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }

    return Promise.reject(error);
  }
);

export default api;
