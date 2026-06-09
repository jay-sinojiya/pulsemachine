// --- FILE: src/collectors/network.collector.ts ---
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
} from '../utils/platform.js';
import type { NetworkMetrics, NetworkInterfaceMetrics } from '../types.js';

interface NetworkSample {
  rxBytes: number;
  txBytes: number;
  timestamp: number;
}

function parseProcNetDev(content: string): Omit<NetworkInterfaceMetrics, 'rxBytesPerSec' | 'txBytesPerSec'>[] {
  const interfaces: Omit<NetworkInterfaceMetrics, 'rxBytesPerSec' | 'txBytesPerSec'>[] = [];
  const lines = content.split('\n').slice(2);

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      continue;
    }

    const iface = line.slice(0, colonIndex).trim();
    const data = line.slice(colonIndex + 1).trim().split(/\s+/);

    if (!iface || iface === 'lo') {
      continue;
    }

    interfaces.push({
      interface: iface,
      rxBytes: parseNumber(data[0]),
      rxPackets: parseNumber(data[1]),
      rxErrors: parseNumber(data[2]),
      rxDrops: parseNumber(data[3]),
      txBytes: parseNumber(data[8]),
      txPackets: parseNumber(data[9]),
      txErrors: parseNumber(data[10]),
      txDrops: parseNumber(data[11]),
      speedMbps: null,
    });
  }

  return interfaces;
}

function parseNetstatIb(output: string): Omit<NetworkInterfaceMetrics, 'rxBytesPerSec' | 'txBytesPerSec'>[] {
  const interfaces: Omit<NetworkInterfaceMetrics, 'rxBytesPerSec' | 'txBytesPerSec'>[] = [];
  const lines = output.trim().split('\n');

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 10 || parts[0] === 'Name') {
      continue;
    }

    const iface = parts[0] ?? '';
    if (!iface || iface === 'lo0') {
      continue;
    }

    interfaces.push({
      interface: iface,
      rxBytes: parseNumber(parts[6]),
      txBytes: parseNumber(parts[9]),
      rxPackets: parseNumber(parts[4]),
      txPackets: parseNumber(parts[7]),
      rxErrors: parseNumber(parts[5]),
      txErrors: 0,
      rxDrops: 0,
      txDrops: 0,
      speedMbps: null,
    });
  }

  return interfaces;
}

function parseWindowsNetAdapter(output: string): Omit<NetworkInterfaceMetrics, 'rxBytesPerSec' | 'txBytesPerSec'>[] {
  const interfaces: Omit<NetworkInterfaceMetrics, 'rxBytesPerSec' | 'txBytesPerSec'>[] = [];
  const blocks = output.split(/\r?\n\r?\n/).filter((b) => b.includes('Name'));

  for (const block of blocks) {
    const getValue = (key: string): string => {
      const match = new RegExp(`${key}\\s*:\\s*(.+)`, 'i').exec(block);
      return match?.[1]?.trim() ?? '';
    };

    const name = getValue('Name');
    if (!name || name.toLowerCase().includes('loopback')) {
      continue;
    }

    interfaces.push({
      interface: name,
      rxBytes: parseNumber(getValue('ReceivedBytes')),
      txBytes: parseNumber(getValue('SentBytes')),
      rxPackets: parseNumber(getValue('ReceivedUnicastPackets')),
      txPackets: parseNumber(getValue('SentUnicastPackets')),
      rxErrors: parseNumber(getValue('ReceivedPacketErrors')),
      txErrors: parseNumber(getValue('OutboundPacketErrors')),
      rxDrops: parseNumber(getValue('ReceivedDiscardedPackets')),
      txDrops: parseNumber(getValue('OutboundDiscardedPackets')),
      speedMbps: parseNumber(getValue('LinkSpeed')) / 1_000_000 || null,
    });
  }

  return interfaces;
}

function applyRates(
  raw: Omit<NetworkInterfaceMetrics, 'rxBytesPerSec' | 'txBytesPerSec'>[],
  prevSamples: Map<string, NetworkSample>,
  now: number,
): NetworkInterfaceMetrics[] {
  return raw.map((iface) => {
    const prev = prevSamples.get(iface.interface);
    let rxBytesPerSec = 0;
    let txBytesPerSec = 0;

    if (prev !== undefined) {
      const elapsed = (now - prev.timestamp) / 1000;
      if (elapsed > 0) {
        rxBytesPerSec = Math.max(0, Math.round((iface.rxBytes - prev.rxBytes) / elapsed));
        txBytesPerSec = Math.max(0, Math.round((iface.txBytes - prev.txBytes) / elapsed));
      }
    }

    prevSamples.set(iface.interface, {
      rxBytes: iface.rxBytes,
      txBytes: iface.txBytes,
      timestamp: now,
    });

    return {
      ...iface,
      rxBytesPerSec,
      txBytesPerSec,
    };
  });
}

export class NetworkCollector extends BaseCollector<NetworkMetrics> {
  readonly name = 'network';

  private readonly prevSamples = new Map<string, NetworkSample>();

  isSupported(): boolean {
    return isSupportedPlatform();
  }

  protected getFallback(): NetworkMetrics {
    return {
      interfaces: [],
      available: false,
    };
  }

  protected async collectInternal(): Promise<NetworkMetrics> {
    const now = Date.now();
    let raw: Omit<NetworkInterfaceMetrics, 'rxBytesPerSec' | 'txBytesPerSec'>[] = [];

    if (isLinux()) {
      const content = await safeReadFile(() => readFile('/proc/net/dev', 'utf-8'));
      if (content !== null) {
        raw = parseProcNetDev(content);
      }
    } else if (isMacOS()) {
      const output = await safeExec('netstat', ['-ib']);
      if (output) {
        raw = parseNetstatIb(output);
      }
    } else if (isWindows()) {
      const output = await safeExec('powershell', [
        '-NoProfile',
        '-Command',
        'Get-NetAdapterStatistics | Format-List',
      ]);
      if (output) {
        raw = parseWindowsNetAdapter(output);
      }
    }

    const interfaces = applyRates(raw, this.prevSamples, now);

    return {
      interfaces,
      available: interfaces.length > 0,
    };
  }
}
