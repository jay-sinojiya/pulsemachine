// --- FILE: src/cli/dashboard.ts ---
import blessed from 'blessed';
import type { Monitor } from '../monitor.js';
import type { SystemStats } from '../types.js';

function thresholdColor(value: number): string {
  if (value >= 80) {
    return 'red';
  }
  if (value >= 60) {
    return 'yellow';
  }
  return 'green';
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) {
    return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  }
  if (bytes >= 1_048_576) {
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${String(bytes)} B`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${String(days)}d`);
  }
  if (hours > 0) {
    parts.push(`${String(hours)}h`);
  }
  parts.push(`${String(minutes)}m`);
  return parts.join(' ');
}

/**
 * Blessed-based terminal dashboard with live-updating panels.
 */
export class Dashboard {
  private readonly monitor: Monitor;
  private screen: blessed.Widgets.Screen | null = null;
  private unsubscribe: (() => void) | null = null;
  private cpuBox: blessed.Widgets.BoxElement | null = null;
  private memBox: blessed.Widgets.BoxElement | null = null;
  private diskBox: blessed.Widgets.BoxElement | null = null;
  private netBox: blessed.Widgets.BoxElement | null = null;
  private procBox: blessed.Widgets.BoxElement | null = null;
  private headerBox: blessed.Widgets.BoxElement | null = null;

  constructor(monitor: Monitor) {
    this.monitor = monitor;
  }

  async start(): Promise<void> {
    this.createLayout();
    await this.monitor.start();

    this.unsubscribe = this.monitor.watch((stats) => {
      this.render(stats);
    });
  }

  async stop(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    await this.monitor.stop();

    if (this.screen) {
      this.screen.destroy();
      this.screen = null;
    }
  }

  private createLayout(): void {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'pulsemachine Dashboard',
    });

    this.headerBox = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      tags: true,
      style: { fg: 'white', bg: 'blue' },
      content: ' {bold}pulsemachine{/bold} — System Monitor Dashboard ',
    });

    this.cpuBox = blessed.box({
      parent: this.screen,
      label: ' CPU ',
      top: 3,
      left: 0,
      width: '50%',
      height: '40%',
      border: { type: 'line' },
      tags: true,
      scrollable: true,
    });

    this.memBox = blessed.box({
      parent: this.screen,
      label: ' MEMORY ',
      top: 3,
      left: '50%',
      width: '50%',
      height: '40%',
      border: { type: 'line' },
      tags: true,
      scrollable: true,
    });

    this.diskBox = blessed.box({
      parent: this.screen,
      label: ' DISK ',
      top: '40%+3',
      left: 0,
      width: '50%',
      height: '30%',
      border: { type: 'line' },
      tags: true,
      scrollable: true,
    });

    this.netBox = blessed.box({
      parent: this.screen,
      label: ' NETWORK ',
      top: '40%+3',
      left: '50%',
      width: '50%',
      height: '30%',
      border: { type: 'line' },
      tags: true,
      scrollable: true,
    });

    this.procBox = blessed.box({
      parent: this.screen,
      label: ' TOP PROCESSES ',
      top: '70%+3',
      left: 0,
      width: '100%',
      height: '30%-3',
      border: { type: 'line' },
      tags: true,
      scrollable: true,
    });

    this.screen.key(['escape', 'q', 'C-c'], () => {
      void this.stop().then(() => {
        process.exit(0);
      });
    });

    this.screen.render();
  }

  private render(stats: SystemStats): void {
    if (!this.screen || !this.cpuBox || !this.memBox || !this.diskBox || !this.netBox || !this.procBox || !this.headerBox) {
      return;
    }

    const cpuColor = thresholdColor(stats.cpu.averageUsagePercent);
    const memColor = thresholdColor(stats.memory.usagePercent);
    const diskColor = thresholdColor(stats.disk.maxUsagePercent);

    this.headerBox.setContent(
      ` {bold}pulsemachine{/bold} | Uptime: ${formatUptime(stats.uptime.uptimeSeconds)} | Load: ${stats.uptime.loadAverage.map((l) => l.toFixed(2)).join(', ')} `,
    );

    const coreLines = stats.cpu.cores
      .map(
        (c) =>
          `  Core ${String(c.core)}: {${thresholdColor(c.usagePercent)}-fg}${c.usagePercent.toFixed(1)}%{/} @ ${String(c.speedMhz)} MHz`,
      )
      .join('\n');

    this.cpuBox.setContent(
      `  Average: {${cpuColor}-fg}${stats.cpu.averageUsagePercent.toFixed(1)}%{/}\n` +
        `  Frequency: ${String(stats.cpu.frequencyMhz)} MHz\n` +
        `  Temperature: ${stats.cpu.temperatureCelsius !== null ? `${stats.cpu.temperatureCelsius.toFixed(1)}°C` : 'N/A'}\n` +
        coreLines,
    );

    this.memBox.setContent(
      `  Usage: {${memColor}-fg}${stats.memory.usagePercent.toFixed(1)}%{/}\n` +
        `  Total: ${formatBytes(stats.memory.totalBytes)}\n` +
        `  Used:  ${formatBytes(stats.memory.usedBytes)}\n` +
        `  Free:  ${formatBytes(stats.memory.freeBytes)}\n` +
        `  Cached: ${formatBytes(stats.memory.cachedBytes)}\n` +
        `  Swap:  ${stats.memory.swapUsagePercent.toFixed(1)}% (${formatBytes(stats.memory.swapUsedBytes)} / ${formatBytes(stats.memory.swapTotalBytes)})\n` +
        `  Pressure: {${stats.memory.pressure === 'high' ? 'red' : stats.memory.pressure === 'medium' ? 'yellow' : 'green'}-fg}${stats.memory.pressure.toUpperCase()}{/}`,
    );

    const mountLines = stats.disk.mounts
      .slice(0, 8)
      .map((m) => {
        const color = thresholdColor(m.usagePercent);
        return `  ${m.mount}: {${color}-fg}${m.usagePercent.toFixed(1)}%{/} (${formatBytes(m.usedBytes)} / ${formatBytes(m.totalBytes)})`;
      })
      .join('\n');

    this.diskBox.setContent(
      `  Max Usage: {${diskColor}-fg}${stats.disk.maxUsagePercent.toFixed(1)}%{/}\n` + mountLines,
    );

    const netLines = stats.network.interfaces
      .slice(0, 6)
      .map(
        (n) =>
          `  ${n.interface}: RX ${formatBytes(n.rxBytesPerSec)}/s TX ${formatBytes(n.txBytesPerSec)}/s`,
      )
      .join('\n');

    this.netBox.setContent(netLines || '  No network interfaces detected');

    const procLines = stats.processes.topByCpu
      .slice(0, 10)
      .map((p, i) => {
        const color = thresholdColor(p.cpuPercent);
        return `  ${String(i + 1).padStart(2)}. [${String(p.pid).padStart(6)}] {${color}-fg}${p.cpuPercent.toFixed(1)}%{/} MEM ${p.memoryPercent.toFixed(1)}% ${p.name}`;
      })
      .join('\n');

    this.procBox.setContent(procLines || '  No process data available');

    this.screen.render();
  }
}

export function createDashboard(monitor: Monitor): Dashboard {
  return new Dashboard(monitor);
}
