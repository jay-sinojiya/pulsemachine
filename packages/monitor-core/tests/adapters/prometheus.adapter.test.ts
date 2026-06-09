// --- FILE: tests/adapters/prometheus.adapter.test.ts ---
import { describe, it, expect, vi, beforeEach } from 'vitest';
import os from 'os';
import { Monitor } from '../../src/monitor.js';
import { createPrometheusAdapter } from '../../src/adapters/prometheus.adapter.js';
import { createMockSystemStats } from '../mocks/system.mock.js';

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

describe('PrometheusAdapter', () => {
  beforeEach(() => {
    vi.mocked(os.cpus).mockReturnValue([
      { model: 'x', speed: 2400, times: { user: 1, nice: 0, sys: 1, idle: 98, irq: 0 } },
    ] as os.CpuInfo[]);
    vi.mocked(os.totalmem).mockReturnValue(16_000_000_000);
    vi.mocked(os.freemem).mockReturnValue(8_000_000_000);
    vi.mocked(os.uptime).mockReturnValue(100);
    vi.mocked(os.loadavg).mockReturnValue([1, 1, 1]);
  });

  it('should update all metric families from full stats', async () => {
    const monitor = new Monitor({ enableDocker: false });
    const adapter = createPrometheusAdapter(monitor, { prefix: 'full', labels: { env: 'test' } });

    const stats = createMockSystemStats({
      disk: {
        mounts: [{ mount: '/data', filesystem: 'xfs', totalBytes: 100, usedBytes: 80, freeBytes: 20, usagePercent: 80 }],
        io: [{ device: 'sda', readIops: 10, writeIops: 5, readBytesPerSec: 1024, writeBytesPerSec: 512 }],
        maxUsagePercent: 80,
        available: true,
      },
      network: {
        interfaces: [{
          interface: 'eth0', rxBytes: 1000, txBytes: 2000, rxPackets: 10, txPackets: 20,
          rxErrors: 0, txErrors: 0, rxDrops: 0, txDrops: 0, speedMbps: 1000,
          rxBytesPerSec: 100, txBytesPerSec: 200,
        }],
        available: true,
      },
      docker: {
        containers: [{
          id: 'abc', name: 'web', image: 'nginx', state: 'running', status: 'up',
          cpuPercent: 12, memoryUsageBytes: 100, memoryLimitBytes: 200, memoryPercent: 50,
          networkRxBytes: 1, networkTxBytes: 2, blockReadBytes: 3, blockWriteBytes: 4,
        }],
        available: true,
        error: null,
      },
      processes: {
        topByCpu: [{ pid: 1, name: 'node', user: 'root', state: 'S', cpuPercent: 10, memoryPercent: 5, memoryBytes: 1000 }],
        topByMemory: [{ pid: 1, name: 'node', user: 'root', state: 'S', cpuPercent: 10, memoryPercent: 5, memoryBytes: 1000 }],
        available: true,
      },
    });

    adapter.start();
    vi.spyOn(monitor, 'getStats').mockResolvedValue(stats);
    const metrics = await adapter.getMetrics();

    expect(metrics).toContain('full_disk_read_bytes_total');
    expect(metrics).toContain('full_container_cpu_percent');
    adapter.stop();
  });

  it('should register and export metrics', async () => {
    const monitor = new Monitor({ enableDocker: false });
    const adapter = createPrometheusAdapter(monitor, { prefix: 'test_monitor' });

    adapter.start();
    const metrics = await adapter.getMetrics();

    expect(metrics).toContain('test_monitor_cpu_usage_percent');
    adapter.stop();
  });

  it('should return 500 when metrics collection fails', async () => {
    const monitor = new Monitor({ enableDocker: false });
    const adapter = createPrometheusAdapter(monitor);

    vi.spyOn(monitor, 'getStats').mockRejectedValue(new Error('collect failed'));

    const handler = adapter.createMetricsRouter();
    const res = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      setHeader: vi.fn(),
      json: vi.fn(),
      end: vi.fn(),
    };

    await handler({ method: 'GET', url: '/metrics', headers: {}, query: {} }, res);

    expect(res.statusCode).toBe(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'collect failed' });
  });

  it('should create metrics router handler', async () => {
    const monitor = new Monitor({ enableDocker: false });
    const adapter = createPrometheusAdapter(monitor);

    vi.spyOn(monitor, 'getStats').mockResolvedValue(createMockSystemStats());

    const handler = adapter.createMetricsRouter();
    const res = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      setHeader: vi.fn(),
      json: vi.fn(),
      end: vi.fn(),
    };

    await handler({ method: 'GET', url: '/metrics', headers: {}, query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.end).toHaveBeenCalled();
  });
});
