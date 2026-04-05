import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../config/api';

const TOKEN_STORAGE_KEY = 'sbleToken';

const AuthContext = createContext({
  keycloak: {
    authenticated: false,
    token: null,
    tokenParsed: null,
    hasRealmRole: () => false,
    login: async () => {},
    logout: () => {},
    updateToken: async () => true
  },
  initialized: false,
  login: async () => {},
  logout: () => {}
});

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState(null);
  const [initialized, setInitialized] = useState(false);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const loadProfile = useCallback(async () => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!storedToken) {
      setInitialized(true);
      return;
    }

    try {
      const response = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${storedToken}` }
      });
      setToken(storedToken);
      setUser(response.data);
    } catch (_) {
      logout();
    } finally {
      setInitialized(true);
    }
  }, [logout]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const login = useCallback(async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const nextToken = response.data.token;

    localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    setToken(nextToken);
    setUser(response.data.user);

    return response.data.user;
  }, []);

  const roles = Array.isArray(user?.roles)
    ? user.roles
    : user?.role
      ? [user.role]
      : [];

  const keycloak = useMemo(() => ({
    authenticated: Boolean(token),
    token,
    tokenParsed: token
      ? {
          sub: user?.id,
          email: user?.email,
          name: user?.full_name || user?.name || 'User',
          realm_access: { roles }
        }
      : null,
    hasRealmRole: (role) => roles.includes(role),
    login,
    logout,
    updateToken: async () => true
  }), [login, logout, roles, token, user]);

  return (
    <AuthContext.Provider value={{ keycloak, initialized, login, logout, user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useKeycloak = () => useContext(AuthContext);
