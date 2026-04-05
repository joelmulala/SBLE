import { useEffect } from 'react';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';

/**
 * Syncs the authenticated Keycloak user into the local SBLE database.
 * Called once on app mount after authentication.
 */
export default function useAuthSync() {
  const { keycloak, initialized } = useKeycloak();

  useEffect(() => {
    if (initialized && keycloak.authenticated) {
      api.post('/auth/sync').catch(() => {
        // Sync failure is non-fatal — user may already exist
      });
    }
  }, [initialized, keycloak.authenticated]);
}
