// --- FILE: src/adapters/websocket.adapter.ts ---
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Monitor } from '../monitor.js';
import type { MetricNamespace, SystemStats, WebSocketAdapterOptions, WebSocketSubscription } from '../types.js';

interface ClientState {
  ws: WebSocket;
  subscription: WebSocketSubscription;
  alive: boolean;
}

interface WsMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping';
  namespaces?: MetricNamespace[];
}

/**
 * WebSocket adapter for real-time metric streaming.
 * Supports per-client namespace subscriptions, heartbeats, and reconnection hints.
 */
export class WebSocketAdapter {
  private readonly monitor: Monitor;
  private readonly options: Required<WebSocketAdapterOptions>;
  private wss: WebSocketServer | null = null;
  private readonly clients = new Map<WebSocket, ClientState>();
  private unsubscribe: (() => void) | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(monitor: Monitor, options: WebSocketAdapterOptions = {}) {
    this.monitor = monitor;
    this.options = {
      port: options.port ?? 9100,
      host: options.host ?? '0.0.0.0',
      heartbeatIntervalMs: options.heartbeatIntervalMs ?? 30_000,
      path: options.path ?? '/ws',
    };
  }

  /** Start the WebSocket server */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({
          port: this.options.port,
          host: this.options.host,
          path: this.options.path,
        });

        this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
          this.handleConnection(ws, req);
        });

        this.wss.on('listening', () => {
          this.unsubscribe = this.monitor.watch((stats) => {
            this.broadcast(stats);
          });
          this.startHeartbeat();
          resolve();
        });

        this.wss.on('error', (error: Error) => {
          reject(error);
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /** Stop the WebSocket server */
  async stop(): Promise<void> {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    for (const client of this.clients.values()) {
      try {
        client.ws.close(1000, 'Server shutting down');
      } catch {
        // ignore close errors
      }
    }
    this.clients.clear();

    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss?.close(() => {
          resolve();
        });
      });
      this.wss = null;
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const state: ClientState = {
      ws,
      subscription: { namespaces: ['all'] },
      alive: true,
    };

    this.clients.set(ws, state);

    ws.send(
      JSON.stringify({
        type: 'connected',
        path: this.options.path,
        reconnectMs: 3000,
        timestamp: Date.now(),
      }),
    );

    ws.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        let raw: string;
        if (typeof data === 'string') {
          raw = data;
        } else if (Buffer.isBuffer(data)) {
          raw = data.toString('utf-8');
        } else if (Array.isArray(data)) {
          raw = Buffer.concat(data).toString('utf-8');
        } else {
          raw = Buffer.from(data).toString('utf-8');
        }
        const message = JSON.parse(raw) as WsMessage;
        this.handleMessage(ws, message);
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON message' }));
      }
    });

    ws.on('pong', () => {
      const client = this.clients.get(ws);
      if (client) {
        client.alive = true;
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
    });

    ws.on('error', () => {
      this.clients.delete(ws);
    });

    const remoteAddress = req.socket.remoteAddress ?? 'unknown';
    ws.send(
      JSON.stringify({
        type: 'welcome',
        clientId: remoteAddress,
        availableNamespaces: [
          'cpu',
          'memory',
          'disk',
          'network',
          'process',
          'docker',
          'uptime',
          'all',
        ],
      }),
    );
  }

  private handleMessage(ws: WebSocket, message: WsMessage): void {
    const client = this.clients.get(ws);
    if (!client) {
      return;
    }

    switch (message.type) {
      case 'subscribe':
        client.subscription = {
          namespaces: message.namespaces ?? ['all'],
        };
        ws.send(
          JSON.stringify({
            type: 'subscribed',
            namespaces: client.subscription.namespaces,
          }),
        );
        break;

      case 'unsubscribe':
        client.subscription = { namespaces: [] };
        ws.send(JSON.stringify({ type: 'unsubscribed' }));
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;

      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
    }
  }

  private broadcast(stats: SystemStats): void {
    for (const client of this.clients.values()) {
      if (client.ws.readyState !== WebSocket.OPEN) {
        continue;
      }

      const payload = this.filterStats(stats, client.subscription);
      try {
        client.ws.send(JSON.stringify({ type: 'stats', data: payload, timestamp: stats.timestamp }));
      } catch {
        this.clients.delete(client.ws);
      }
    }
  }

  private filterStats(
    stats: SystemStats,
    subscription: WebSocketSubscription,
  ): Partial<SystemStats> & { timestamp: number } {
    if (subscription.namespaces.includes('all') || subscription.namespaces.length === 0) {
      return stats;
    }

    const result: Partial<SystemStats> & { timestamp: number } = {
      timestamp: stats.timestamp,
    };

    for (const ns of subscription.namespaces) {
      switch (ns) {
        case 'cpu':
          result.cpu = stats.cpu;
          break;
        case 'memory':
          result.memory = stats.memory;
          break;
        case 'disk':
          result.disk = stats.disk;
          break;
        case 'network':
          result.network = stats.network;
          break;
        case 'process':
          result.processes = stats.processes;
          break;
        case 'docker':
          result.docker = stats.docker;
          break;
        case 'uptime':
          result.uptime = stats.uptime;
          break;
        default:
          break;
      }
    }

    return result;
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const [ws, client] of this.clients.entries()) {
        if (!client.alive) {
          ws.terminate();
          this.clients.delete(ws);
          continue;
        }
        client.alive = false;
        try {
          ws.ping();
        } catch {
          this.clients.delete(ws);
        }
      }
    }, this.options.heartbeatIntervalMs);
  }
}

export function createWebSocketAdapter(
  monitor: Monitor,
  options?: WebSocketAdapterOptions,
): WebSocketAdapter {
  return new WebSocketAdapter(monitor, options);
}
