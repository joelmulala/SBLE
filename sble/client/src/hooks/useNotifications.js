import { useEffect, useState } from 'react';
import { useKeycloak } from '../auth/AuthProvider';

/**
 * Connects to the SSE notification stream and returns a list of notifications.
 * Automatically reconnects if the connection drops.
 */
export default function useNotifications() {
  const { keycloak, initialized } = useKeycloak();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!initialized || !keycloak.authenticated) return;

    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    const url = `${apiUrl}/notifications/stream`;

    // SSE requires the token in the URL since EventSource doesn't support headers
    const es = new EventSource(`${url}?token=${keycloak.token}`);

    es.addEventListener('grade', (e) => {
      const data = JSON.parse(e.data);
      setNotifications(prev => [{ id: Date.now(), type: 'grade', ...data }, ...prev]);
    });

    es.addEventListener('exam-released', (e) => {
      const data = JSON.parse(e.data);
      setNotifications(prev => [{ id: Date.now(), type: 'exam', ...data }, ...prev]);
    });

    es.onerror = () => es.close();

    return () => es.close();
  }, [initialized, keycloak.authenticated, keycloak.token]);

  const dismiss = (id) => setNotifications(prev => prev.filter(n => n.id !== id));

  return { notifications, dismiss };
}
