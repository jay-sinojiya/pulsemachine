// --- FILE: tests/collectors/memory.collector.test.ts ---
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import { readFile } from 'fs/promises';
import { MemoryCollector } from '../../src/collectors/memory.collector.js';
import { mockMemInfo } from '../mocks/system.mock.js';

vi.mock('os');
vi.mock('fs/promises');

describe('MemoryCollector', () => {
  beforeEach(() => {
    vi.mocked(os.totalmem).mockReturnValue(16_000_000_000);
    vi.mocked(os.freemem).mockReturnValue(8_000_000_000);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should parse /proc/meminfo on Linux', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });

    vi.mocked(readFile).mockResolvedValue(mockMemInfo);

    const collector = new MemoryCollector();
    const result = await collector.collect();

    expect(result.available).toBe(true);
    expect(result.totalBytes).toBe(16384000 * 1024);
    expect(result.cachedBytes).toBeGreaterThan(0);
    expect(result.swapUsagePercent).toBe(50);
    expect(['low', 'medium', 'high']).toContain(result.pressure);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should fall back to os module when meminfo unavailable', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    const collector = new MemoryCollector();
    const result = await collector.collect();

    expect(result.available).toBe(true);
    expect(result.totalBytes).toBe(16_000_000_000);
    expect(result.usedBytes).toBe(8_000_000_000);
    expect(result.usagePercent).toBe(50);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should report medium memory pressure', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });

    vi.mocked(readFile).mockResolvedValue(`MemTotal:       10000 kB
MemFree:          2000 kB
MemAvailable:     2000 kB
Buffers:             0 kB
Cached:              0 kB
SwapTotal:        10000 kB
SwapFree:         6000 kB`);

    const collector = new MemoryCollector();
    const result = await collector.collect();

    expect(result.pressure).toBe('medium');

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should report high memory pressure', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });

    vi.mocked(readFile).mockResolvedValue(`MemTotal:       10000 kB
MemFree:           500 kB
MemAvailable:      500 kB
Buffers:             0 kB
Cached:              0 kB
SwapTotal:        10000 kB
SwapFree:           500 kB`);

    const collector = new MemoryCollector();
    const result = await collector.collect();

    expect(result.pressure).toBe('high');
    expect(result.usagePercent).toBeGreaterThan(90);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should return fallback when collection fails', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    vi.mocked(os.totalmem).mockImplementation(() => {
      throw new Error('fail');
    });
    vi.mocked(os.freemem).mockImplementation(() => {
      throw new Error('fail');
    });

    const collector = new MemoryCollector();
    const result = await collector.collect();

    expect(result.available).toBe(false);
    expect(result.totalBytes).toBe(0);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });
});
