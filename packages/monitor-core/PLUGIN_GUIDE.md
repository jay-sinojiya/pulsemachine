# Plugin Development Guide

This guide explains how to build plugins for `pulsemachine`.

## MonitorPlugin Interface

```typescript
import type { MonitorLike, MonitorPlugin, SystemStats } from 'pulsemachine';

export interface MonitorPlugin {
  name: string;
  version: string;
  install(monitor: MonitorLike): void;
  onStart?(): void | Promise<void>;
  onStop?(): void | Promise<void>;
  onStats?(stats: SystemStats): void | Promise<void>;
}
```

| Member | Required | Description |
|---|---|---|
| `name` | Yes | Unique plugin identifier |
| `version` | Yes | Semver version string |
| `install(monitor)` | Yes | Called when plugin is registered via `monitor.use()` |
| `onStart()` | No | Called when `monitor.start()` runs |
| `onStop()` | No | Called when `monitor.stop()` runs |
| `onStats(stats)` | No | Called after each collection tick |

## Lifecycle Hooks

```
monitor.use(plugin)
       │
       ▼
  install(monitor)     ← Register listeners, resolve deps
       │
monitor.start()
       │
       ▼
    onStart()          ← Begin side effects
       │
  ┌────┴────┐
  │  tick   │──► onStats(stats)   ← Every interval
  └────┬────┘
       │
monitor.stop()
       │
       ▼
    onStop()           ← Cleanup
```

1. **install** — Wire up to the monitor API. Store references, register event listeners, or set up DI.
2. **onStart** — Begin active work (open connections, start timers).
3. **onStats** — React to each metrics snapshot (log, forward, aggregate).
4. **onStop** — Tear down resources opened in `onStart`.

## Full Example Plugin

```typescript
import {
  Monitor,
  type MonitorLike,
  type MonitorPlugin,
  type SystemStats,
} from 'pulsemachine';

interface SlackPluginOptions {
  webhookUrl: string;
  cpuThreshold?: number;
}

export class SlackAlertPlugin implements MonitorPlugin {
  readonly name = 'slack-alerts';
  readonly version = '1.0.0';

  private monitor: MonitorLike | null = null;
  private readonly webhookUrl: string;
  private readonly cpuThreshold: number;

  constructor(options: SlackPluginOptions) {
    this.webhookUrl = options.webhookUrl;
    this.cpuThreshold = options.cpuThreshold ?? 90;
  }

  install(monitor: MonitorLike): void {
    this.monitor = monitor;

    monitor.on('cpu-high', (value: number) => {
      void this.sendAlert(`CPU usage critical: ${String(value)}%`);
    });
  }

  async onStart(): Promise<void> {
    console.log(`[${this.name}] Listening for alerts above ${String(this.cpuThreshold)}%`);
  }

  async onStats(stats: SystemStats): Promise<void> {
    if (stats.cpu.averageUsagePercent > this.cpuThreshold) {
      await this.sendAlert(
        `Sustained high CPU: ${stats.cpu.averageUsagePercent.toFixed(1)}%`,
      );
    }
  }

  async onStop(): Promise<void> {
    this.monitor = null;
  }

  private async sendAlert(message: string): Promise<void> {
    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[${this.name}] Failed to send alert: ${msg}`);
    }
  }
}

// Usage
const monitor = new Monitor();
monitor.use(new SlackAlertPlugin({ webhookUrl: 'https://hooks.slack.com/...' }));
await monitor.start();
```

## Publishing a Community Plugin

1. **Create a standalone npm package** (e.g. `@myorg/monitor-plugin-slack`).
2. **Declare a peer dependency** on `pulsemachine` so consumers resolve a single copy.
3. **Export a factory function** for ergonomic setup:

```typescript
import type { MonitorPlugin } from 'pulsemachine';

export function slackAlerts(options: SlackPluginOptions): MonitorPlugin {
  return new SlackAlertPlugin(options);
}
```

4. **Document** required permissions, env vars, and platform support in your README.
5. **Test** with mocked `MonitorLike` — never require real system calls in unit tests.
6. **Publish** to npm with the `monitor-plugin` keyword for discoverability.

```bash
npm publish --access public
```

## Best Practices

- Keep `install()` side-effect free beyond wiring — defer I/O to `onStart()`.
- Always clean up in `onStop()` (timers, sockets, file handles).
- Handle errors internally; a plugin crash should not take down the monitor.
- Use `onStats` for periodic work; use alert events for threshold reactions.
- Version your plugin semver independently from `pulsemachine`.
