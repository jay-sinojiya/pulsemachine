// --- FILE: examples/basic-usage.ts ---
import { Monitor } from '../src/index.js';

async function main(): Promise<void> {
  const monitor = new Monitor({
    interval: 5000,
    threshold: { cpu: 80, memory: 90, disk: 85 },
  });

  monitor.on('cpu-high', (value: number) => {
    console.warn(`CPU alert: ${String(value)}%`);
  });

  monitor.on('memory-high', (value: number) => {
    console.warn(`Memory alert: ${String(value)}%`);
  });

  monitor.on('disk-high', (value: number) => {
    console.warn(`Disk alert: ${String(value)}%`);
  });

  const stats = await monitor.getStats();
  console.log('One-shot snapshot:', {
    cpu: `${stats.cpu.averageUsagePercent.toFixed(1)}%`,
    memory: `${stats.memory.usagePercent.toFixed(1)}%`,
    disk: `${stats.disk.maxUsagePercent.toFixed(1)}%`,
    uptime: `${String(Math.floor(stats.uptime.uptimeSeconds / 60))} minutes`,
  });

  monitor.watch((liveStats) => {
    console.log(
      `[${new Date(liveStats.timestamp).toISOString()}] CPU: ${liveStats.cpu.averageUsagePercent.toFixed(1)}%`,
    );
  });

  await monitor.start();

  setTimeout(() => {
    void monitor.stop().then(() => {
      console.log('Monitor stopped.');
      process.exit(0);
    });
  }, 15_000);
}

void main();
