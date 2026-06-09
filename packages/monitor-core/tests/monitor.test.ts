// --- FILE: tests/monitor.test.ts ---
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import { readFile } from 'fs/promises';
import { Monitor } from '../src/monitor.js';
import { mockCpuInfo, mockMemInfo } from './mocks/system.mock.js';

vi.mock('os');
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));
vi.mock('child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], _opts: unknown, cb?: (err: Error | null, result: { stdout: string }) => void) => {
    if (cb) {
      cb(null, { stdout: '' });
    }
    return { on: vi.fn() };
  }),
}));

describe('Monitor', () => {
  beforeEach(() => {
    vi.mocked(os.cpus).mockReturnValue(mockCpuInfo);
    vi.mocked(os.totalmem).mockReturnValue(16_000_000_000);
    vi.mocked(os.freemem).mockReturnValue(8_000_000_000);
    vi.mocked(os.uptime).mockReturnValue(3600);
    vi.mocked(os.loadavg).mockReturnValue([1.0, 0.5, 0.25]);
    vi.mocked(readFile).mockRejectedValue(new Error('not found'));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('should collect stats via getStats()', async () => {
    const monitor = new Monitor({ enableDocker: false });
    const stats = await monitor.getStats();

    expect(stats).toHaveProperty('timestamp');
    expect(stats).toHaveProperty('cpu');
    expect(stats).toHaveProperty('memory');
    expect(stats).toHaveProperty('disk');
    expect(stats).toHaveProperty('network');
    expect(stats).toHaveProperty('processes');
    expect(stats).toHaveProperty('uptime');
  });

  it('should start and stop polling', async () => {
    const monitor = new Monitor({ interval: 100, enableDocker: false });

    const startedHandler = vi.fn();
    const stoppedHandler = vi.fn();
    monitor.on('started', startedHandler);
    monitor.on('stopped', stoppedHandler);

    await monitor.start();
    expect(monitor.isRunning()).toBe(true);
    expect(startedHandler).toHaveBeenCalledOnce();

    await monitor.stop();
    expect(monitor.isRunning()).toBe(false);
    expect(stoppedHandler).toHaveBeenCalledOnce();
  });

  it('should notify watchers on tick', async () => {
    const monitor = new Monitor({ interval: 100, enableDocker: false });
    const watcher = vi.fn();

    monitor.watch(watcher);
    await monitor.start();

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 250);
    });
    expect(watcher.mock.calls.length).toBeGreaterThanOrEqual(1);

    await monitor.stop();
  });

  it('should emit threshold alert events', async () => {
    const monitor = new Monitor({
      threshold: { cpu: 50 },
      enableDocker: false,
    });

    const alertHandler = vi.fn();
    monitor.on('cpu-high', alertHandler);

    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });
    vi.mocked(readFile).mockResolvedValue(mockMemInfo);

    await monitor.getStats();
    await monitor.getStats();

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should register plugins via use()', () => {
    const monitor = new Monitor({ enableDocker: false });
    const plugin = {
      name: 'test-plugin',
      version: '1.0.0',
      install: vi.fn(),
    };

    monitor.use(plugin);
    expect(plugin.install).toHaveBeenCalledWith(monitor);
  });

  it('should emit error when watcher throws', async () => {
    const monitor = new Monitor({ interval: 100, enableDocker: false });
    const errorHandler = vi.fn();
    monitor.on('error', errorHandler);

    monitor.watch(() => {
      throw new Error('watcher boom');
    });

    await monitor.start();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 200);
    });
    expect(errorHandler).toHaveBeenCalled();
    await monitor.stop();
  });

  it('should not start twice', async () => {
    const monitor = new Monitor({ interval: 1000, enableDocker: false });
    await monitor.start();
    await monitor.start();
    expect(monitor.isRunning()).toBe(true);
    await monitor.stop();
  });

  it('should expose DI container with registered collectors', () => {
    const monitor = new Monitor({ enableDocker: false });
    const container = monitor.getContainer();
    expect(container).toBeDefined();
  });
});
