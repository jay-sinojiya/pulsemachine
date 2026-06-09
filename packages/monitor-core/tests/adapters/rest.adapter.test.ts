// --- FILE: tests/adapters/rest.adapter.test.ts ---
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Monitor } from '../../src/monitor.js';
import {
  createRestRouter,
  createExpressMiddleware,
  registerFastifyRoutes,
} from '../../src/adapters/rest.adapter.js';
import type { RestRequest, RestResponse } from '../../src/types.js';
import os from 'os';

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

function createMockResponse(): RestResponse & {
  statusCode: number;
  body: unknown;
  end: ReturnType<typeof vi.fn>;
} {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.body = data;
    },
    setHeader: vi.fn(),
    end: vi.fn(),
  };
  return res;
}

describe('createRestRouter', () => {
  beforeEach(() => {
    vi.mocked(os.cpus).mockReturnValue([
      { model: 'x', speed: 2400, times: { user: 1, nice: 0, sys: 1, idle: 98, irq: 0 } },
    ] as os.CpuInfo[]);
    vi.mocked(os.totalmem).mockReturnValue(16_000_000_000);
    vi.mocked(os.freemem).mockReturnValue(8_000_000_000);
    vi.mocked(os.uptime).mockReturnValue(100);
    vi.mocked(os.loadavg).mockReturnValue([1, 1, 1]);
  });

  it('should handle GET /stats', async () => {
    const monitor = new Monitor({ enableDocker: false });
    const router = createRestRouter(monitor);
    const req: RestRequest = { method: 'GET', url: '/stats', headers: {}, query: {} };
    const res = createMockResponse();

    const handled = await router.handle(req, res);

    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('cpu');
  });

  it('should handle GET /health', async () => {
    const monitor = new Monitor({ enableDocker: false });
    const router = createRestRouter(monitor);
    const req: RestRequest = { method: 'GET', url: '/health', headers: {}, query: {} };
    const res = createMockResponse();

    const handled = await router.handle(req, res);

    expect(handled).toBe(true);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('should handle GET /metrics', async () => {
    const monitor = new Monitor({ enableDocker: false });
    const router = createRestRouter(monitor);
    const res = createMockResponse();

    await router.handle({ method: 'GET', url: '/metrics', headers: {}, query: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.end).toHaveBeenCalled();
  });

  it('should handle GET /processes and /containers', async () => {
    const monitor = new Monitor({ enableDocker: false });
    const router = createRestRouter(monitor);

    const procRes = createMockResponse();
    await router.handle({ method: 'GET', url: '/processes', headers: {}, query: {} }, procRes);
    expect(procRes.body).toHaveProperty('topByCpu');

    const contRes = createMockResponse();
    await router.handle({ method: 'GET', url: '/containers', headers: {}, query: {} }, contRes);
    expect(contRes.body).toHaveProperty('containers');
  });

  it('should provide express middleware and fastify registrar', async () => {
    const monitor = new Monitor({ enableDocker: false });
    const next = vi.fn();

    const middleware = createExpressMiddleware(monitor);
    const res = createMockResponse();
    await middleware({ method: 'GET', url: '/health', headers: {}, query: {} }, res, next);
    expect(next).not.toHaveBeenCalled();

    const routes: string[] = [];
    registerFastifyRoutes(monitor, {
      get: (path: string) => {
        routes.push(path);
      },
    });
    expect(routes).toContain('/stats');
    expect(routes).toContain('/metrics');
  });

  it('should return false for unknown routes', async () => {
    const monitor = new Monitor({ enableDocker: false });
    const router = createRestRouter(monitor);
    const req: RestRequest = { method: 'POST', url: '/unknown', headers: {}, query: {} };
    const res = createMockResponse();

    const handled = await router.handle(req, res);
    expect(handled).toBe(false);
  });
});
