// --- FILE: tests/collectors/unsupported.collector.test.ts ---
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CpuCollector } from '../../src/collectors/cpu.collector.js';
import { MemoryCollector } from '../../src/collectors/memory.collector.js';
import { DiskCollector } from '../../src/collectors/disk.collector.js';
import { NetworkCollector } from '../../src/collectors/network.collector.js';
import { ProcessCollector } from '../../src/collectors/process.collector.js';

vi.mock('../../src/utils/platform.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/platform.js')>();
  return {
    ...actual,
    isSupportedPlatform: () => false,
  };
});

describe('collectors on unsupported platform', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return fallback for all collectors', async () => {
    const collectors = [
      new CpuCollector(),
      new MemoryCollector(),
      new DiskCollector(),
      new NetworkCollector(),
      new ProcessCollector(),
    ];

    for (const collector of collectors) {
      const result = await collector.collect();
      expect(result.available).toBe(false);
    }
  });
});
