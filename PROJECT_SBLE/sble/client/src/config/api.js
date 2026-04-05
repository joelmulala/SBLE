import axios from 'axios';
import keycloak from './keycloak';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api'
});

// Attach Keycloak token to every request
api.interceptors.request.use(async (config) => {
  if (keycloak.authenticated) {
    await keycloak.updateToken(30); // refresh if expiring in <30s
    config.headers.Authorization = `Bearer ${keycloak.token}`;
  }
  return config;
});

export default api;
