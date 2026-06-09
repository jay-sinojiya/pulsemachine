// --- FILE: src/collectors/uptime.collector.ts ---
import os from 'os';
import { BaseCollector } from './base.collector.js';
import { isSupportedPlatform } from '../utils/platform.js';
import type { UptimeMetrics } from '../types.js';

export class UptimeCollector extends BaseCollector<UptimeMetrics> {
  readonly name = 'uptime';

  isSupported(): boolean {
    return isSupportedPlatform();
  }

  protected getFallback(): UptimeMetrics {
    return {
      uptimeSeconds: 0,
      loadAverage: [0, 0, 0],
      available: false,
    };
  }

  protected collectInternal(): Promise<UptimeMetrics> {
    const uptimeSeconds = os.uptime();
    const loadAverage = os.loadavg();

    return Promise.resolve({
      uptimeSeconds,
      loadAverage: [...loadAverage],
      available: true,
    });
  }
}
