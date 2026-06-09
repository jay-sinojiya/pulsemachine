// --- FILE: examples/custom-plugin.ts ---
import { Monitor, type MonitorPlugin, type MonitorLike, type SystemStats } from '../src/index.js';

class MetricsLoggerPlugin implements MonitorPlugin {
  readonly name = 'metrics-logger';
  readonly version = '1.0.0';

  private monitor: MonitorLike | null = null;
  private sampleCount = 0;

  install(monitor: MonitorLike): void {
    this.monitor = monitor;
    console.log(`[${this.name}] Plugin installed`);
  }

  async onStart(): Promise<void> {
    console.log(`[${this.name}] Plugin started`);
  }

  async onStats(stats: SystemStats): Promise<void> {
    this.sampleCount++;
    if (this.sampleCount % 5 === 0) {
      console.log(
        `[${this.name}] Sample #${String(this.sampleCount)}: ` +
          `CPU=${stats.cpu.averageUsagePercent.toFixed(1)}% ` +
          `MEM=${stats.memory.usagePercent.toFixed(1)}% ` +
          `NET_IFACES=${String(stats.network.interfaces.length)}`,
      );
    }
  }

  async onStop(): Promise<void> {
    console.log(`[${this.name}] Plugin stopped after ${String(this.sampleCount)} samples`);
    this.monitor = null;
  }
}

async function main(): Promise<void> {
  const monitor = new Monitor({ interval: 2000, enableDocker: false });
  monitor.use(new MetricsLoggerPlugin());

  await monitor.start();

  setTimeout(() => {
    void monitor.stop().then(() => process.exit(0));
  }, 12_000);
}

void main();
