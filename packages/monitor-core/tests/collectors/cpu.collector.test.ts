// --- FILE: tests/collectors/cpu.collector.test.ts ---
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import { CpuCollector } from '../../src/collectors/cpu.collector.js';
import { mockCpuInfo } from '../mocks/system.mock.js';

vi.mock('os');
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockRejectedValue(new Error('not found')),
}));

describe('CpuCollector', () => {
  beforeEach(() => {
    vi.mocked(os.cpus).mockReturnValue(mockCpuInfo);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should report as supported on known platforms', () => {
    const collector = new CpuCollector();
    expect(collector.isSupported()).toBe(true);
  });

  it('should return fallback on first sample with zero usage', async () => {
    const collector = new CpuCollector(10, 0);
    const result = await collector.collect();

    expect(result.available).toBe(true);
    expect(result.cores).toHaveLength(2);
    expect(result.averageUsagePercent).toBe(0);
    expect(result.frequencyMhz).toBe(2400);
  });

  it('should compute usage percent on second sample', async () => {
    const collector = new CpuCollector(10, 0);

    vi.mocked(os.cpus).mockReturnValue(mockCpuInfo);
    await collector.collect();

    const updatedCpus = mockCpuInfo.map((cpu) => ({
      ...cpu,
      times: {
        ...cpu.times,
        user: cpu.times.user + 100,
        idle: cpu.times.idle + 50,
      },
    }));

    vi.mocked(os.cpus).mockReturnValue(updatedCpus);
    const result = await collector.collect();

    expect(result.available).toBe(true);
    expect(result.averageUsagePercent).toBeGreaterThan(0);
    expect(result.history.length).toBeGreaterThan(0);
  });

  it('should read temperature from thermal zone on Linux', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });

    const { readFile } = await import('fs/promises');
    vi.mocked(readFile).mockResolvedValue('45000\n');

    const collector = new CpuCollector(10, 0);
    await collector.collect();
    const result = await collector.collect();

    expect(result.temperatureCelsius).toBe(45);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should return fallback when os.cpus throws', async () => {
    vi.mocked(os.cpus).mockImplementation(() => {
      throw new Error('os error');
    });

    const collector = new CpuCollector();
    const result = await collector.collect();

    expect(result.available).toBe(false);
    expect(result.cores).toHaveLength(0);
  });
});
