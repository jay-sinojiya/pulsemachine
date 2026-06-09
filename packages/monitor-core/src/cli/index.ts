#!/usr/bin/env node
// --- FILE: src/cli/index.ts ---
import { Monitor } from '../monitor.js';
import { createDashboard } from './dashboard.js';

function parseArgs(argv: string[]): { interval: number } {
  let interval = 1000;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--interval' || arg === '-i') {
      const next = argv[i + 1];
      if (next !== undefined) {
        const parsed = Number(next);
        if (Number.isFinite(parsed) && parsed > 0) {
          interval = parsed;
        }
        i++;
      }
    }
  }

  return { interval };
}

async function main(): Promise<void> {
  const { interval } = parseArgs(process.argv);

  const monitor = new Monitor({
    interval,
    threshold: { cpu: 80, memory: 90, disk: 85 },
  });

  const dashboard = createDashboard(monitor);

  process.on('SIGINT', () => {
    void dashboard.stop().then(() => {
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    void dashboard.stop().then(() => {
      process.exit(0);
    });
  });

  try {
    await dashboard.start();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to start dashboard: ${message}`);
    process.exit(1);
  }
}

void main();
