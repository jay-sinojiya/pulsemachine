// --- FILE: src/collectors/disk.collector.ts ---
import { readFile } from 'fs/promises';
import { BaseCollector } from './base.collector.js';
import {
  isLinux,
  isMacOS,
  isWindows,
  isSupportedPlatform,
  parseNumber,
  safeExec,
  safeReadFile,
  toPercent,
} from '../utils/platform.js';
import type { DiskMetrics, DiskMountMetrics, DiskIoMetrics } from '../types.js';

interface IoSample {
  readSectors: number;
  writeSectors: number;
  timestamp: number;
}

function parseDfOutput(output: string): DiskMountMetrics[] {
  const lines = output.trim().split('\n').slice(1);
  const mounts: DiskMountMetrics[] = [];

  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length < 6) {
      continue;
    }
    const filesystem = parts[0] ?? '';
    const totalKb = parseNumber(parts[1]);
    const usedKb = parseNumber(parts[2]);
    const availableKb = parseNumber(parts[3]);
    const mountPoint = parts[5] ?? '';

    if (totalKb <= 0 || mountPoint === '' || !mountPoint.startsWith('/')) {
      continue;
    }

    const totalBytes = totalKb * 1024;
    const usedBytes = usedKb * 1024;
    const freeBytes = availableKb * 1024;

    mounts.push({
      mount: mountPoint,
      filesystem,
      totalBytes,
      usedBytes,
      freeBytes,
      usagePercent: toPercent(usedBytes, totalBytes),
    });
  }

  return mounts;
}

function parseWmicOutput(output: string): DiskMountMetrics[] {
  const mounts: DiskMountMetrics[] = [];
  const blocks = output.split(/\r?\n\r?\n/).filter((b) => b.includes('DeviceID'));

  for (const block of blocks) {
    const getValue = (key: string): string => {
      const match = new RegExp(`${key}=(.+)`, 'i').exec(block);
      return match?.[1]?.trim() ?? '';
    };

    const deviceId = getValue('DeviceID');
    const size = parseNumber(getValue('Size'));
    const freeSpace = parseNumber(getValue('FreeSpace'));

    if (deviceId && size > 0) {
      const usedBytes = size - freeSpace;
      mounts.push({
        mount: deviceId,
        filesystem: 'NTFS',
        totalBytes: size,
        usedBytes,
        freeBytes: freeSpace,
        usagePercent: toPercent(usedBytes, size),
      });
    }
  }

  return mounts;
}

function parseDiskstats(content: string, prevSamples: Map<string, IoSample>, now: number): DiskIoMetrics[] {
  const results: DiskIoMetrics[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 14) {
      continue;
    }

    const device = parts[2] ?? '';
    if (!device || device.startsWith('loop') || device.startsWith('ram')) {
      continue;
    }

    const readSectors = parseNumber(parts[5]);
    const writeSectors = parseNumber(parts[9]);
    const prev = prevSamples.get(device);

    let readIops = 0;
    let writeIops = 0;
    let readBytesPerSec = 0;
    let writeBytesPerSec = 0;

    if (prev !== undefined) {
      const elapsed = (now - prev.timestamp) / 1000;
      if (elapsed > 0) {
        const readDelta = readSectors - prev.readSectors;
        const writeDelta = writeSectors - prev.writeSectors;
        readBytesPerSec = Math.round((readDelta * 512) / elapsed);
        writeBytesPerSec = Math.round((writeDelta * 512) / elapsed);
        readIops = Math.round(readDelta / elapsed);
        writeIops = Math.round(writeDelta / elapsed);
      }
    }

    prevSamples.set(device, { readSectors, writeSectors, timestamp: now });

    results.push({
      device,
      readIops: Math.max(0, readIops),
      writeIops: Math.max(0, writeIops),
      readBytesPerSec: Math.max(0, readBytesPerSec),
      writeBytesPerSec: Math.max(0, writeBytesPerSec),
    });
  }

  return results;
}

export class DiskCollector extends BaseCollector<DiskMetrics> {
  readonly name = 'disk';

  private readonly ioPrevSamples = new Map<string, IoSample>();

  isSupported(): boolean {
    return isSupportedPlatform();
  }

  protected getFallback(): DiskMetrics {
    return {
      mounts: [],
      io: [],
      maxUsagePercent: 0,
      available: false,
    };
  }

  protected async collectInternal(): Promise<DiskMetrics> {
    const mounts = await this.collectMounts();
    const io = await this.collectIo();
    const maxUsagePercent =
      mounts.length > 0 ? Math.max(...mounts.map((m) => m.usagePercent)) : 0;

    return {
      mounts,
      io,
      maxUsagePercent,
      available: mounts.length > 0 || io.length > 0,
    };
  }

  private async collectMounts(): Promise<DiskMountMetrics[]> {
    if (isLinux() || isMacOS()) {
      const output = await safeExec('df', ['-P', '-k']);
      if (output) {
        return parseDfOutput(output);
      }
    }

    if (isWindows()) {
      const output = await safeExec('wmic', [
        'logicaldisk',
        'get',
        'DeviceID,Size,FreeSpace',
        '/format:list',
      ]);
      if (output) {
        return parseWmicOutput(output);
      }
    }

    return [];
  }

  private async collectIo(): Promise<DiskIoMetrics[]> {
    if (!isLinux()) {
      return [];
    }

    const content = await safeReadFile(() => readFile('/proc/diskstats', 'utf-8'));
    if (content === null) {
      return [];
    }

    return parseDiskstats(content, this.ioPrevSamples, Date.now());
  }
}
