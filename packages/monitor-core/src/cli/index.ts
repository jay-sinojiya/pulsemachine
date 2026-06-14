#!/usr/bin/env node
// --- FILE: src/cli/index.ts ---
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import os from 'node:os';
import { Monitor } from '../monitor.js';
import { createDashboard } from './dashboard.js';

function parseArgs(argv: string[]): { interval: number; version: boolean; info: boolean } {
  let interval = 1000;
  let version = false;
  let info = false;

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
    } else if (arg === '--version' || arg === '-v') {
      version = true;
    } else if (arg === '--info') {
      info = true;
    }
  }

  return { interval, version, info };
}

async function main(): Promise<void> {
  const { interval, version, info } = parseArgs(process.argv);

  if (version || info) {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      // dist/cli/index.js is 2 directories down from the package root
      const pkgPath = join(__dirname, '../../package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      
      console.log(`Pulse Machine v${pkg.version}`);
      
      if (info) {
        console.log('');
        console.log('System Information:');
        console.log(`  Node.js:   ${process.version}`);
        console.log(`  OS:        ${os.type()} ${os.release()} (${os.arch()})`);
        console.log(`  Platform:  ${process.platform}`);
        console.log(`  V8 Engine: ${process.versions.v8}`);
        console.log(`  Memory:    ${Math.round(os.totalmem() / 1024 / 1024)} MB`);
      }
      process.exit(0);
    } catch (err) {
      console.error('Failed to read version information.', err);
      process.exit(1);
    }
  }

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
