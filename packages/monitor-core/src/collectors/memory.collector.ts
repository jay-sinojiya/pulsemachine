// --- FILE: src/collectors/memory.collector.ts ---
import os from 'os';
import { readFile } from 'fs/promises';
import { BaseCollector } from './base.collector.js';
import { isLinux, isSupportedPlatform, parseNumber, safeReadFile, toPercent } from '../utils/platform.js';
import type { MemoryMetrics } from '../types.js';

interface MemInfo {
  memTotal: number;
  memFree: number;
  memAvailable: number;
  buffers: number;
  cached: number;
  swapTotal: number;
  swapFree: number;
}

function parseMemInfo(content: string): MemInfo {
  const lines = content.split('\n');
  const values: Record<string, number> = {};

  for (const line of lines) {
    const match = /^(\w+):\s+(\d+)/.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      values[match[1]] = parseNumber(match[2]) * 1024;
    }
  }

  return {
    memTotal: values['MemTotal'] ?? 0,
    memFree: values['MemFree'] ?? 0,
    memAvailable: values['MemAvailable'] ?? values['MemFree'] ?? 0,
    buffers: values['Buffers'] ?? 0,
    cached: values['Cached'] ?? 0,
    swapTotal: values['SwapTotal'] ?? 0,
    swapFree: values['SwapFree'] ?? 0,
  };
}

function computePressure(usagePercent: number, swapUsagePercent: number): 'low' | 'medium' | 'high' {
  if (usagePercent >= 90 || swapUsagePercent >= 80) {
    return 'high';
  }
  if (usagePercent >= 75 || swapUsagePercent >= 50) {
    return 'medium';
  }
  return 'low';
}

export class MemoryCollector extends BaseCollector<MemoryMetrics> {
  readonly name = 'memory';

  isSupported(): boolean {
    return isSupportedPlatform();
  }

  protected getFallback(): MemoryMetrics {
    return {
      totalBytes: 0,
      usedBytes: 0,
      freeBytes: 0,
      cachedBytes: 0,
      usagePercent: 0,
      swapTotalBytes: 0,
      swapUsedBytes: 0,
      swapUsagePercent: 0,
      pressure: 'low',
      available: false,
    };
  }

  protected async collectInternal(): Promise<MemoryMetrics> {
    if (isLinux()) {
      return this.collectLinux();
    }
    return this.collectGeneric();
  }

  private async collectLinux(): Promise<MemoryMetrics> {
    const content = await safeReadFile(() => readFile('/proc/meminfo', 'utf-8'));
    if (content !== null) {
      const info = parseMemInfo(content);
      const usedBytes = info.memTotal - info.memAvailable;
      const cachedBytes = info.buffers + info.cached;
      const swapUsedBytes = info.swapTotal - info.swapFree;
      const usagePercent = toPercent(usedBytes, info.memTotal);
      const swapUsagePercent = toPercent(swapUsedBytes, info.swapTotal);

      return {
        totalBytes: info.memTotal,
        usedBytes,
        freeBytes: info.memFree,
        cachedBytes,
        usagePercent,
        swapTotalBytes: info.swapTotal,
        swapUsedBytes,
        swapUsagePercent,
        pressure: computePressure(usagePercent, swapUsagePercent),
        available: true,
      };
    }
    return this.collectGeneric();
  }

  private collectGeneric(): MemoryMetrics {
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const usedBytes = totalBytes - freeBytes;
    const usagePercent = toPercent(usedBytes, totalBytes);

    return {
      totalBytes,
      usedBytes,
      freeBytes,
      cachedBytes: 0,
      usagePercent,
      swapTotalBytes: 0,
      swapUsedBytes: 0,
      swapUsagePercent: 0,
      pressure: computePressure(usagePercent, 0),
      available: true,
    };
  }
}
