import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function useJobEvents() {
  const { token } = useAuth();
  const [lastEvent, setLastEvent] = useState<any>(null);

  useEffect(() => {
    if (!token) return;

    const eventSource = new EventSource(`/api/v1/events/stream`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLastEvent(data);
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [token]);

  return lastEvent;
}
