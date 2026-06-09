// --- FILE: src/collectors/process.collector.ts ---
import { BaseCollector } from './base.collector.js';
import {
  isLinux,
  isMacOS,
  isWindows,
  isSupportedPlatform,
  parseNumber,
  safeExec,
} from '../utils/platform.js';
import type { ProcessListMetrics, ProcessMetrics } from '../types.js';

function parseLinuxPs(output: string): ProcessMetrics[] {
  const processes: ProcessMetrics[] = [];
  const lines = output.trim().split('\n').slice(1);

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 8) {
      continue;
    }

    const user = parts[0] ?? '';
    const pid = parseNumber(parts[1]);
    const cpuPercent = parseNumber(parts[2]);
    const memoryPercent = parseNumber(parts[3]);
    const state = parts[7] ?? '';
    const name = parts.slice(7).join(' ').replace(/^\[/, '').replace(/\]$/, '');

    processes.push({
      pid,
      name: name || 'unknown',
      user,
      state,
      cpuPercent,
      memoryPercent,
      memoryBytes: 0,
    });
  }

  return processes;
}

function parseMacPs(output: string): ProcessMetrics[] {
  const processes: ProcessMetrics[] = [];
  const lines = output.trim().split('\n').slice(1);

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 11) {
      continue;
    }

    const user = parts[0] ?? 'unknown';
    const pid = parseNumber(parts[1]);
    const cpuPercent = parseNumber(parts[2]);
    const memoryPercent = parseNumber(parts[3]);
    const state = parts[7] ?? 'running';
    const name = parts.slice(10).join(' ');

    processes.push({
      pid,
      name: name || 'unknown',
      user,
      state,
      cpuPercent,
      memoryPercent,
      memoryBytes: 0,
    });
  }

  return processes;
}

function parseWindowsTasklist(output: string): ProcessMetrics[] {
  const processes: ProcessMetrics[] = [];
  const lines = output.trim().split('\n').slice(1);

  for (const line of lines) {
    const match = /^"([^"]+)","(\d+)","[^"]*","(\d+)"/.exec(line);
    if (!match) {
      continue;
    }

    const name = match[1] ?? 'unknown';
    const pid = parseNumber(match[2]);
    const memoryKb = parseNumber(match[3]);

    processes.push({
      pid,
      name,
      user: 'unknown',
      state: 'running',
      cpuPercent: 0,
      memoryPercent: 0,
      memoryBytes: memoryKb * 1024,
    });
  }

  return processes;
}

function sortTopByCpu(processes: ProcessMetrics[], limit: number): ProcessMetrics[] {
  return [...processes].sort((a, b) => b.cpuPercent - a.cpuPercent).slice(0, limit);
}

function sortTopByMemory(processes: ProcessMetrics[], limit: number): ProcessMetrics[] {
  return [...processes]
    .sort((a, b) => {
      if (b.memoryBytes !== a.memoryBytes) {
        return b.memoryBytes - a.memoryBytes;
      }
      return b.memoryPercent - a.memoryPercent;
    })
    .slice(0, limit);
}

export class ProcessCollector extends BaseCollector<ProcessListMetrics> {
  readonly name = 'process';

  private readonly limit: number;

  constructor(limit = 10) {
    super();
    this.limit = limit;
  }

  isSupported(): boolean {
    return isSupportedPlatform();
  }

  protected getFallback(): ProcessListMetrics {
    return {
      topByCpu: [],
      topByMemory: [],
      available: false,
    };
  }

  protected async collectInternal(): Promise<ProcessListMetrics> {
    let processes: ProcessMetrics[] = [];

    if (isLinux()) {
      const output = await safeExec('ps', [
        'aux',
        '--sort=-%cpu',
        '--no-headers',
      ]);
      if (output) {
        processes = parseLinuxPs(
          'USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND\n' + output,
        );
      }
    } else if (isMacOS()) {
      const output = await safeExec('ps', ['aux', '-r']);
      if (output) {
        processes = parseMacPs(output);
      }
    } else if (isWindows()) {
      const output = await safeExec('tasklist', ['/FO', 'CSV', '/NH']);
      if (output) {
        processes = parseWindowsTasklist(output);
      }
    }

    return {
      topByCpu: sortTopByCpu(processes, this.limit),
      topByMemory: sortTopByMemory(processes, this.limit),
      available: processes.length > 0,
    };
  }
}
