import { useMemo } from 'react';
import { useKeycloak } from '../auth/AuthProvider';

/**
 * Single source for realm roles on assessment surfaces (lecturer includes admin).
 */
export function useAssessmentRoles() {
  const { keycloak } = useKeycloak();

  return useMemo(() => {
    const isAdmin = keycloak?.hasRealmRole?.('admin') ?? false;
    const isLecturer = isAdmin || (keycloak?.hasRealmRole?.('lecturer') ?? false);
    const isStudent = Boolean(keycloak?.hasRealmRole?.('student'));

    return {
      isAdmin,
      isLecturer,
      isStudent
    };
  }, [keycloak]);
}
