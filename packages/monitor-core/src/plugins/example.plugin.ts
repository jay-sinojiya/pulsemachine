// --- FILE: src/plugins/example.plugin.ts ---
import type { MonitorLike, MonitorPlugin, SystemStats } from '../types.js';

/**
 * Example plugin demonstrating the MonitorPlugin interface.
 * Logs a summary line on each stats tick.
 */
export class ExamplePlugin implements MonitorPlugin {
  readonly name = 'example';
  readonly version = '1.0.0';

  private monitor: MonitorLike | null = null;
  private unsubscribe: (() => void) | null = null;

  install(monitor: MonitorLike): void {
    this.monitor = monitor;
  }

  onStart(): void {
    if (!this.monitor) {
      return;
    }

    this.unsubscribe = this.monitor.watch((stats: SystemStats) => {
      this.onStats(stats);
    });
  }

  onStop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  onStats(stats: SystemStats): void {
    const cpu = stats.cpu.averageUsagePercent.toFixed(1);
    const mem = stats.memory.usagePercent.toFixed(1);
    const disk = stats.disk.maxUsagePercent.toFixed(1);
    console.log(
      `[example-plugin] CPU: ${cpu}% | MEM: ${mem}% | DISK: ${disk}% | Procs: ${String(stats.processes.topByCpu.length)}`,
    );
  }
}

export function createExamplePlugin(): MonitorPlugin {
  return new ExamplePlugin();
}
