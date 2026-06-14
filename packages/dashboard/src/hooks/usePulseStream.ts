import { useState, useEffect, useRef } from 'react';
import type { SystemStats } from 'pulsemachine';

export interface PulseData {
  stats: SystemStats | null;
  history: {
    cpu: number[];
    memory: number[];
    time: string[];
  };
  connected: boolean;
  error: string | null;
}

const HISTORY_LIMIT = 60;

export function usePulseStream(url = 'ws://127.0.0.1:9100/ws') {
  const [data, setData] = useState<PulseData>({
    stats: null,
    history: { cpu: [], memory: [], time: [] },
    connected: false,
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          setData(prev => ({ ...prev, connected: true, error: null }));
          // Subscribe to standard namespaces
          ws.send(
            JSON.stringify({
              type: 'subscribe',
              namespaces: ['cpu', 'memory', 'disk', 'network', 'docker', 'process'],
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'stats') {
              const stats: SystemStats = message.data;
              setData(prev => {
                const now = new Date();
                const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
                
                const newCpuHistory = [...prev.history.cpu, stats.cpu.averageUsagePercent];
                const newMemHistory = [...prev.history.memory, stats.memory.usagePercent];
                const newTimeHistory = [...prev.history.time, timeStr];

                if (newCpuHistory.length > HISTORY_LIMIT) {
                  newCpuHistory.shift();
                  newMemHistory.shift();
                  newTimeHistory.shift();
                }

                return {
                  ...prev,
                  stats,
                  history: {
                    cpu: newCpuHistory,
                    memory: newMemHistory,
                    time: newTimeHistory,
                  }
                };
              });
            }
          } catch (err) {
            console.error('Failed to parse WS message', err);
          }
        };

        ws.onclose = () => {
          setData(prev => ({ ...prev, connected: false }));
          // Reconnect after 3 seconds
          setTimeout(connect, 3000);
        };

        ws.onerror = (err) => {
          console.error('WebSocket error:', err);
          setData(prev => ({ ...prev, error: 'Connection error' }));
        };
      } catch (err) {
        console.error('WebSocket setup error:', err);
      }
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [url]);

  return data;
}
