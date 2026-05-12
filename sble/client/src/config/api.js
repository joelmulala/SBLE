import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
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
