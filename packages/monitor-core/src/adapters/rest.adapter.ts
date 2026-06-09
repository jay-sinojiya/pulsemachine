// --- FILE: src/adapters/rest.adapter.ts ---
import type { Monitor } from '../monitor.js';
import type { RestRequest, RestResponse, RestRouter, RouteHandler } from '../types.js';
import { createPrometheusAdapter } from './prometheus.adapter.js';

/**
 * Framework-agnostic REST router factory.
 * Provides GET /stats, /metrics, /processes, /containers endpoints.
 */
export function createRestRouter(monitor: Monitor): RestRouter {
  const routes = new Map<string, RouteHandler>();
  const prometheus = createPrometheusAdapter(monitor);

  prometheus.start();

  routes.set('GET /stats', async (_req, res) => {
    try {
      const stats = await monitor.getStats();
      res.status(200);
      res.json(stats);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal error';
      res.status(500);
      res.json({ error: message });
    }
  });

  routes.set('GET /metrics', prometheus.createMetricsRouter());

  routes.set('GET /processes', async (_req, res) => {
    try {
      const stats = await monitor.getStats();
      res.status(200);
      res.json({
        topByCpu: stats.processes.topByCpu,
        topByMemory: stats.processes.topByMemory,
        available: stats.processes.available,
        timestamp: stats.timestamp,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal error';
      res.status(500);
      res.json({ error: message });
    }
  });

  routes.set('GET /containers', async (_req, res) => {
    try {
      const stats = await monitor.getStats();
      res.status(200);
      res.json({
        containers: stats.docker.containers,
        available: stats.docker.available,
        error: stats.docker.error,
        timestamp: stats.timestamp,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal error';
      res.status(500);
      res.json({ error: message });
    }
  });

  routes.set('GET /health', (_req, res) => {
    res.status(200);
    res.json({
      status: 'ok',
      running: monitor.isRunning(),
      timestamp: Date.now(),
    });
  });

  const handle = async (req: RestRequest, res: RestResponse): Promise<boolean> => {
    const pathname = extractPathname(req.url);
    const key = `${req.method.toUpperCase()} ${pathname}`;
    const handler = routes.get(key);

    if (!handler) {
      return false;
    }

    await handler(req, res);
    return true;
  };

  return { handle, routes };
}

function extractPathname(url: string): string {
  const questionIndex = url.indexOf('?');
  const path = questionIndex === -1 ? url : url.slice(0, questionIndex);
  return path || '/';
}

/**
 * Express-compatible middleware factory.
 */
export function createExpressMiddleware(monitor: Monitor): (
  req: RestRequest,
  res: RestResponse,
  next: () => void,
) => Promise<void> {
  const router = createRestRouter(monitor);

  return async (req, res, next) => {
    const handled = await router.handle(req, res);
    if (!handled) {
      next();
    }
  };
}

/**
 * Fastify-compatible route registrar.
 */
export function registerFastifyRoutes(
  monitor: Monitor,
  fastify: {
    get: (path: string, handler: RouteHandler) => void;
  },
): void {
  const router = createRestRouter(monitor);

  for (const [routeKey, handler] of router.routes.entries()) {
    const spaceIndex = routeKey.indexOf(' ');
    const method = routeKey.slice(0, spaceIndex);
    const path = routeKey.slice(spaceIndex + 1);

    if (method === 'GET') {
      fastify.get(path, handler);
    }
  }
}
