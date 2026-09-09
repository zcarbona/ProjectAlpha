import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function useJobEvents() {
  const { token } = useAuth();
  const [lastEvent, setLastEvent] = useState<any>(null);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    const connect = async () => {
      try {
        const response = await fetch('/api/events/stream', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`SSE connection failed: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!controller.signal.aborted) {
          const { value, done } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const messages = buffer.split('\n\n');
          buffer = messages.pop() ?? '';

          for (const message of messages) {
            const dataLine = message
              .split('\n')
              .find((line) => line.startsWith('data: '));

            if (!dataLine) continue;

            try {
              const data = JSON.parse(dataLine.slice(6));
              setLastEvent(data);
            } catch {
              // Ignore malformed SSE messages.
            }
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Job event stream error:', error);
        }
      }
    };

    connect();

    return () => {
      controller.abort();
    };
  }, [token]);

  return lastEvent;
}
