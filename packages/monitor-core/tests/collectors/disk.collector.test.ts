// --- FILE: tests/collectors/disk.collector.test.ts ---
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFile } from 'fs/promises';
import { DiskCollector } from '../../src/collectors/disk.collector.js';
import { mockDfOutput } from '../mocks/system.mock.js';

const mockSafeExec = vi.fn();

vi.mock('../../src/utils/platform.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/platform.js')>();
  return {
    ...actual,
    safeExec: (...args: Parameters<typeof actual.safeExec>) => mockSafeExec(...args),
  };
});

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

describe('DiskCollector', () => {
  beforeEach(() => {
    mockSafeExec.mockReset();
    vi.mocked(readFile).mockRejectedValue(new Error('not found'));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should parse df output on Linux', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });

    mockSafeExec.mockResolvedValue(mockDfOutput);

    const collector = new DiskCollector();
    const result = await collector.collect();

    expect(result.available).toBe(true);
    expect(result.mounts.length).toBeGreaterThan(0);
    expect(result.maxUsagePercent).toBe(50);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should parse diskstats for I/O on Linux', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });

    mockSafeExec.mockResolvedValue(mockDfOutput);
    vi.mocked(readFile).mockResolvedValue(
      '   8       0 sda 100 0 2000 50 80 0 3000 60 0 0 0 0 0 0\n',
    );

    const collector = new DiskCollector();
    await collector.collect();
    const result = await collector.collect();

    expect(result.io.length).toBeGreaterThan(0);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should parse wmic output on Windows', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });

    mockSafeExec.mockResolvedValue(
      'DeviceID=C:\nSize=107374182400\nFreeSpace=53687091200\n\n',
    );

    const collector = new DiskCollector();
    const result = await collector.collect();

    expect(result.mounts.length).toBeGreaterThan(0);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should return fallback when no data available', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    mockSafeExec.mockResolvedValue('');

    const collector = new DiskCollector();
    const result = await collector.collect();

    expect(result.available).toBe(false);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });
});
