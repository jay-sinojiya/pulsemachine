// --- FILE: tests/adapters/websocket.adapter.test.ts ---
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { Monitor } from '../../src/monitor.js';
import { WebSocketAdapter } from '../../src/adapters/websocket.adapter.js';
import os from 'os';

const wssInstances: EventEmitter[] = [];
const wsClients: Array<
  EventEmitter & {
    send: ReturnType<typeof vi.fn>;
    readyState: number;
    ping: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
  }
> = [];

vi.mock('ws', () => ({
  WebSocket: Object.assign(
    class MockWebSocket extends EventEmitter {
      static OPEN = 1;
      readyState = 1;
      send = vi.fn();
      ping = vi.fn();
      close = vi.fn();
      terminate = vi.fn();
      constructor() {
        super();
        wsClients.push(this);
      }
    },
    { OPEN: 1 },
  ),
  WebSocketServer: class MockWebSocketServer extends EventEmitter {
    constructor() {
      super();
      wssInstances.push(this);
    }

    close(cb?: () => void): void {
      if (cb) cb();
    }
  },
}));

vi.mock('os');
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockRejectedValue(new Error('not found')),
}));
vi.mock('child_process', () => ({
  execFile: vi.fn((_c: string, _a: string[], _o: unknown, cb?: (e: null, r: { stdout: string }) => void) => {
    if (cb) cb(null, { stdout: '' });
    return { on: vi.fn() };
  }),
}));

describe('WebSocketAdapter', () => {
  beforeEach(() => {
    wssInstances.length = 0;
    wsClients.length = 0;
    vi.mocked(os.cpus).mockReturnValue([
      { model: 'x', speed: 2400, times: { user: 1, nice: 0, sys: 1, idle: 98, irq: 0 } },
    ] as os.CpuInfo[]);
    vi.mocked(os.totalmem).mockReturnValue(16_000_000_000);
    vi.mocked(os.freemem).mockReturnValue(8_000_000_000);
    vi.mocked(os.uptime).mockReturnValue(100);
    vi.mocked(os.loadavg).mockReturnValue([1, 1, 1]);
  });

  it('should start server, accept connections, and broadcast via watch', async () => {
    const monitor = new Monitor({ interval: 50, enableDocker: false });
    const adapter = new WebSocketAdapter(monitor, { port: 9101 });

    const startPromise = adapter.start();
    const wss = wssInstances[0];
    wss?.emit('listening');
    await startPromise;

    const client = new (await import('ws')).WebSocket() as (typeof wsClients)[0];
    wss?.emit('connection', client, { socket: { remoteAddress: '127.0.0.1' } });

    await monitor.start();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 120);
    });

    expect(client.send).toHaveBeenCalled();
    expect(adapter.getClientCount()).toBe(1);

    await adapter.stop();
    await monitor.stop();
  });

  it('should handle subscribe and ping messages', async () => {
    const monitor = new Monitor({ enableDocker: false });
    const adapter = new WebSocketAdapter(monitor, { port: 9102 });

    const startPromise = adapter.start();
    const wss = wssInstances[0];
    wss?.emit('listening');
    await startPromise;

    const client = new (await import('ws')).WebSocket() as (typeof wsClients)[0];
    wss?.emit('connection', client, { socket: { remoteAddress: '127.0.0.1' } });

    client.emit(
      'message',
      Buffer.from(JSON.stringify({ type: 'subscribe', namespaces: ['cpu'] })),
    );
    client.emit('message', Buffer.from(JSON.stringify({ type: 'ping' })));

    expect(client.send).toHaveBeenCalled();

    client.emit('message', Buffer.from('not-json'));
    client.emit(
      'message',
      Buffer.from(JSON.stringify({ type: 'unsubscribe' })),
    );
    client.emit('pong');

    await adapter.stop();
  });

  it('should terminate unresponsive clients on heartbeat', async () => {
    vi.useFakeTimers();
    const monitor = new Monitor({ enableDocker: false });
    const adapter = new WebSocketAdapter(monitor, {
      port: 9103,
      heartbeatIntervalMs: 1000,
    });

    const startPromise = adapter.start();
    const wss = wssInstances[0];
    wss?.emit('listening');
    await startPromise;

    const client = new (await import('ws')).WebSocket() as (typeof wsClients)[0];
    wss?.emit('connection', client, { socket: { remoteAddress: '127.0.0.1' } });

    vi.advanceTimersByTime(2500);
    expect(client.terminate).toHaveBeenCalled();

    vi.useRealTimers();
    await adapter.stop();
  });
});
