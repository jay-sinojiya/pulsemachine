// --- FILE: tests/collectors/uptime.collector.test.ts ---
import { describe, it, expect, vi, beforeEach } from 'vitest';
import os from 'os';
import { UptimeCollector } from '../../src/collectors/uptime.collector.js';

vi.mock('os');

describe('UptimeCollector', () => {
  beforeEach(() => {
    vi.mocked(os.uptime).mockReturnValue(86400);
    vi.mocked(os.loadavg).mockReturnValue([1.5, 1.0, 0.5]);
  });

  it('should collect uptime and load average', async () => {
    const collector = new UptimeCollector();
    const result = await collector.collect();

    expect(result.available).toBe(true);
    expect(result.uptimeSeconds).toBe(86400);
    expect(result.loadAverage).toEqual([1.5, 1.0, 0.5]);
  });

  it('should return fallback on error', async () => {
    vi.mocked(os.uptime).mockImplementation(() => {
      throw new Error('fail');
    });

    const collector = new UptimeCollector();
    const result = await collector.collect();

    expect(result.available).toBe(false);
  });
});
