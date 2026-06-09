// --- FILE: tests/collectors/docker.collector.test.ts ---
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { ClientRequest, IncomingMessage } from 'http';
import { DockerCollector } from '../../src/collectors/docker.collector.js';

const mockRequest = vi.fn();

vi.mock('http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('http')>();
  return {
    ...actual,
    request: (...args: Parameters<typeof actual.request>) => mockRequest(...args),
  };
});

describe('DockerCollector', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle non-2xx Docker API responses', async () => {
    mockRequest.mockImplementation((_opts, cb) => {
      const req = new EventEmitter() as ClientRequest & { end: () => void; destroy: () => void };
      req.end = () => {
        const res = new EventEmitter() as IncomingMessage & { statusCode: number };
        res.statusCode = 503;
        if (cb) cb(res);
        res.emit('end');
      };
      req.destroy = vi.fn();
      return req;
    });

    const collector = new DockerCollector(true);
    const result = await collector.collect();

    expect(result.available).toBe(false);
    expect(result.error).toContain('503');
  });

  it('should return unavailable when Docker socket is unreachable', async () => {
    mockRequest.mockImplementation((_opts, _cb) => {
      const req = new EventEmitter() as ClientRequest & { end: () => void; destroy: () => void };
      req.end = () => {
        req.emit('error', new Error('ENOENT'));
      };
      req.destroy = vi.fn();
      return req;
    });

    const collector = new DockerCollector(true);
    const result = await collector.collect();

    expect(result.available).toBe(false);
    expect(result.containers).toHaveLength(0);
    expect(result.error).toBeTruthy();
  });

  it('should return zero CPU when system delta is zero', async () => {
    const containerList = JSON.stringify([
      {
        Id: 'abc123def456',
        Names: ['/zero-cpu'],
        Image: 'alpine:latest',
        State: 'running',
        Status: 'Up',
      },
    ]);

    const statsResponse = JSON.stringify({
      cpu_stats: {
        cpu_usage: { total_usage: 100 },
        system_cpu_usage: 200,
        online_cpus: 1,
      },
      precpu_stats: {
        cpu_usage: { total_usage: 100 },
        system_cpu_usage: 200,
      },
      memory_stats: { usage: 0, limit: 0 },
    });

    let callCount = 0;
    mockRequest.mockImplementation((_opts, cb) => {
      const req = new EventEmitter() as ClientRequest & { end: () => void; destroy: () => void };
      req.end = () => {
        const res = new EventEmitter() as IncomingMessage & { statusCode: number };
        res.statusCode = 200;
        if (cb) cb(res);
        callCount++;
        res.emit('data', Buffer.from(callCount === 1 ? containerList : statsResponse));
        res.emit('end');
      };
      req.destroy = vi.fn();
      return req;
    });

    const collector = new DockerCollector(true);
    const result = await collector.collect();

    expect(result.containers[0]?.cpuPercent).toBe(0);
  });

  it('should parse container list and stats', async () => {
    const containerList = JSON.stringify([
      {
        Id: 'abc123def456',
        Names: ['/my-container'],
        Image: 'nginx:latest',
        State: 'running',
        Status: 'Up 2 hours',
      },
    ]);

    const statsResponse = JSON.stringify({
      cpu_stats: {
        cpu_usage: { total_usage: 200000000 },
        system_cpu_usage: 400000000,
        online_cpus: 2,
      },
      precpu_stats: {
        cpu_usage: { total_usage: 100000000 },
        system_cpu_usage: 200000000,
      },
      memory_stats: { usage: 536870912, limit: 1073741824 },
      networks: { eth0: { rx_bytes: 1000, tx_bytes: 2000 } },
      blkio_stats: {
        io_service_bytes_recursive: [
          { op: 'Read', value: 5000 },
          { op: 'Write', value: 3000 },
        ],
      },
    });

    let callCount = 0;
    mockRequest.mockImplementation((_opts, cb) => {
      const req = new EventEmitter() as ClientRequest & { end: () => void; destroy: () => void };
      req.end = () => {
        const res = new EventEmitter() as IncomingMessage & { statusCode: number };
        res.statusCode = 200;

        if (cb) {
          cb(res);
        }

        callCount++;
        const data = callCount === 1 ? containerList : statsResponse;
        res.emit('data', Buffer.from(data));
        res.emit('end');
      };
      req.destroy = vi.fn();
      return req;
    });

    const collector = new DockerCollector(true);
    const result = await collector.collect();

    expect(result.available).toBe(true);
    expect(result.containers).toHaveLength(1);
    expect(result.containers[0]?.name).toBe('my-container');
    expect(result.containers[0]?.cpuPercent).toBeGreaterThan(0);
    expect(result.containers[0]?.memoryPercent).toBe(50);
  });

  it('should list containers even when stats fetch fails', async () => {
    const containerList = JSON.stringify([
      {
        Id: 'abc123def456',
        Names: ['/fallback-container'],
        Image: 'redis:latest',
        State: 'running',
        Status: 'Up 1 hour',
      },
    ]);

    let callCount = 0;
    mockRequest.mockImplementation((_opts, cb) => {
      const req = new EventEmitter() as ClientRequest & { end: () => void; destroy: () => void };
      req.end = () => {
        const res = new EventEmitter() as IncomingMessage & { statusCode: number };
        res.statusCode = callCount === 1 ? 500 : 200;
        if (cb) cb(res);
        callCount++;
        if (res.statusCode === 200) {
          res.emit('data', Buffer.from(containerList));
        }
        res.emit('end');
      };
      req.destroy = vi.fn();
      return req;
    });

    const collector = new DockerCollector(true);
    const result = await collector.collect();

    expect(result.available).toBe(true);
    expect(result.containers[0]?.name).toBe('fallback-container');
    expect(result.containers[0]?.cpuPercent).toBe(0);
  });

  it('should support HTTP DOCKER_HOST', async () => {
    const originalHost = process.env['DOCKER_HOST'];
    process.env['DOCKER_HOST'] = 'http://127.0.0.1:2375';

    const containerList = JSON.stringify([]);
    mockRequest.mockImplementation((_opts, cb) => {
      const req = new EventEmitter() as ClientRequest & { end: () => void; destroy: () => void };
      req.end = () => {
        const res = new EventEmitter() as IncomingMessage & { statusCode: number };
        res.statusCode = 200;
        if (cb) cb(res);
        res.emit('data', Buffer.from(containerList));
        res.emit('end');
      };
      req.destroy = vi.fn();
      return req;
    });

    const collector = new DockerCollector(true);
    const result = await collector.collect();

    expect(result.available).toBe(true);
    expect(result.containers).toHaveLength(0);

    if (originalHost === undefined) {
      delete process.env['DOCKER_HOST'];
    } else {
      process.env['DOCKER_HOST'] = originalHost;
    }
  });

  it('should be disabled when enableDocker is false', async () => {
    const collector = new DockerCollector(false);
    const result = await collector.collect();

    expect(result.available).toBe(false);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});
