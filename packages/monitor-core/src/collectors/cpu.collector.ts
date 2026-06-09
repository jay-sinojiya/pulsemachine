// --- FILE: src/collectors/cpu.collector.ts ---
import os from 'os';
import { readFile } from 'fs/promises';
import { BaseCollector } from './base.collector.js';
import { RingBuffer } from '../utils/ringbuffer.js';
import { isLinux, isSupportedPlatform, parseNumber, safeReadFile } from '../utils/platform.js';
import type { CpuMetrics, CpuCoreMetrics } from '../types.js';

interface CpuTimes {
  idle: number;
  total: number;
}

function extractCpuTimes(cpus: os.CpuInfo[]): CpuTimes[] {
  return cpus.map((cpu) => {
    const times = cpu.times;
    const idle = times.idle;
    const total = times.user + times.nice + times.sys + times.idle + times.irq;
    return { idle, total };
  });
}

function computeUsagePercent(prev: CpuTimes, curr: CpuTimes): number {
  const idleDelta = curr.idle - prev.idle;
  const totalDelta = curr.total - prev.total;
  if (totalDelta <= 0) {
    return 0;
  }
  const usage = ((totalDelta - idleDelta) / totalDelta) * 100;
  return Math.round(usage * 100) / 100;
}

async function readTemperature(): Promise<number | null> {
  if (!isLinux()) {
    return null;
  }

  const thermalPaths = [
    '/sys/class/thermal/thermal_zone0/temp',
    '/sys/class/hwmon/hwmon0/temp1_input',
    '/sys/class/hwmon/hwmon1/temp1_input',
  ];

  for (const thermalPath of thermalPaths) {
    const content = await safeReadFile(() => readFile(thermalPath, 'utf-8'));
    if (content !== null) {
      const raw = parseNumber(content.trim());
      if (raw > 0) {
        return raw > 1000 ? Math.round(raw / 10) / 100 : raw;
      }
    }
  }

  return null;
}

export class CpuCollector extends BaseCollector<CpuMetrics> {
  readonly name = 'cpu';

  private previousTimes: CpuTimes[] | null = null;
  private readonly history: RingBuffer<number>;
  private sampleIntervalMs: number;

  constructor(historySize = 60, sampleIntervalMs = 1000) {
    super();
    this.history = new RingBuffer<number>(historySize);
    this.sampleIntervalMs = sampleIntervalMs;
  }

  isSupported(): boolean {
    return isSupportedPlatform();
  }

  setSampleInterval(ms: number): void {
    this.sampleIntervalMs = ms;
  }

  protected getFallback(): CpuMetrics {
    return {
      cores: [],
      averageUsagePercent: 0,
      frequencyMhz: 0,
      temperatureCelsius: null,
      history: [],
      available: false,
    };
  }

  protected async collectInternal(): Promise<CpuMetrics> {
    const cpus = os.cpus();
    const currentTimes = extractCpuTimes(cpus);

    let cores: CpuCoreMetrics[] = [];
    let averageUsagePercent = 0;

    if (this.previousTimes !== null && this.previousTimes.length === currentTimes.length) {
      const usages: number[] = [];
      cores = cpus.map((cpu, index) => {
        const prev = this.previousTimes?.[index];
        const curr = currentTimes[index];
        const usagePercent =
          prev !== undefined && curr !== undefined ? computeUsagePercent(prev, curr) : 0;
        usages.push(usagePercent);
        return {
          core: index,
          usagePercent,
          speedMhz: cpu.speed,
        };
      });
      averageUsagePercent =
        usages.length > 0
          ? Math.round((usages.reduce((a, b) => a + b, 0) / usages.length) * 100) / 100
          : 0;
    } else {
      cores = cpus.map((cpu, index) => ({
        core: index,
        usagePercent: 0,
        speedMhz: cpu.speed,
      }));
      averageUsagePercent = 0;
    }

    const hadPreviousSample = this.previousTimes !== null;
    this.previousTimes = currentTimes;

    if (hadPreviousSample && this.sampleIntervalMs > 0) {
      await this.ensureDeltaSample();
    }

    this.history.push(averageUsagePercent);

    const frequencyMhz =
      cores.length > 0
        ? Math.round(cores.reduce((sum, c) => sum + c.speedMhz, 0) / cores.length)
        : 0;

    const temperatureCelsius = await readTemperature();

    return {
      cores,
      averageUsagePercent,
      frequencyMhz,
      temperatureCelsius,
      history: this.history.toArray(),
      available: true,
    };
  }

  private async ensureDeltaSample(): Promise<void> {
    if (this.sampleIntervalMs <= 0) {
      return;
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, Math.min(this.sampleIntervalMs, 500));
    });
  }
}
