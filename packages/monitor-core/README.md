# @myorg/monitor-core

[![npm version](https://img.shields.io/npm/v/@myorg/monitor-core.svg)](https://www.npmjs.com/package/@myorg/monitor-core)
[![build status](https://github.com/myorg/monitor-core/actions/workflows/ci.yml/badge.svg)](https://github.com/myorg/monitor-core/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/badge/coverage-%3E80%25-brightgreen)](https://github.com/myorg/monitor-core)
[![license](https://img.shields.io/npm/l/@myorg/monitor-core.svg)](https://github.com/myorg/monitor-core/blob/main/LICENSE)

Lightweight system monitoring library for Node.js — inspired by Grafana, Netdata, and PM2. Collect CPU, memory, disk, network, process, and Docker metrics with built-in alerts, Prometheus export, WebSocket streaming, and a terminal dashboard.

## Quick Start

```typescript
import { Monitor } from '@myorg/monitor-core';

const monitor = new Monitor({ interval: 5000, threshold: { cpu: 80, memory: 90, disk: 85 } });
const stats = await monitor.getStats();
console.log(`CPU: ${stats.cpu.averageUsagePercent}%`);
```

Three lines to your first metric. Start continuous polling with `await monitor.start()`.

## Installation

```bash
npm install @myorg/monitor-core
```

Requires Node.js >= 18.0.0. Supports Linux, Windows, and macOS with graceful fallback when a metric is unavailable.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Monitor (EventEmitter)                │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │Container │  │PluginRegistry│  │     AlertEngine      │  │
│  │   (DI)   │  │  use(plugin) │  │ hysteresis + cooldown│  │
│  └────┬─────┘  └──────────────┘  └──────────────────────┘  │
│       │                                                      │
│  ┌────┴────────────────────────────────────────────────┐    │
│  │                    ICollector<T>[]                     │    │
│  │  CPU │ Memory │ Disk │ Network │ Process │ Docker    │    │
│  └───────────────────────────────────────────────────────┘    │
│       │                                                      │
│  ┌────┴────────────────────────────────────────────────┐    │
│  │              Adapters (optional)                     │    │
│  │  WebSocket │ Prometheus │ REST │ CLI Dashboard      │    │
│  └───────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## API Reference

| Method / Event | Description |
|---|---|
| `new Monitor(options?)` | Create a monitor instance |
| `monitor.getStats()` | One-shot snapshot of all metrics |
| `monitor.watch(callback)` | Subscribe to polling updates; returns unsubscribe fn |
| `monitor.start()` | Begin periodic collection |
| `monitor.stop()` | Stop periodic collection |
| `monitor.use(plugin)` | Register a plugin |
| `monitor.on('cpu-high', fn)` | CPU threshold alert (value: number) |
| `monitor.on('memory-high', fn)` | Memory threshold alert |
| `monitor.on('disk-high', fn)` | Disk threshold alert |
| `monitor.on('stats', fn)` | Emitted on each collection tick |
| `monitor.on('started' \| 'stopped' \| 'error', fn)` | Lifecycle events |

### MonitorOptions

| Option | Type | Default | Description |
|---|---|---|---|
| `interval` | `number` | `5000` | Polling interval (ms) |
| `threshold` | `ThresholdConfig` | `{ cpu: 80, memory: 90, disk: 85 }` | Alert thresholds (%) |
| `historySize` | `number` | `60` | CPU history ring buffer size |
| `processLimit` | `number` | `10` | Top-N processes |
| `enableDocker` | `boolean` | `true` | Enable Docker collection |
| `alertCooldownMs` | `number` | `60000` | Alert cooldown (ms) |

## Alert Configuration

```typescript
const monitor = new Monitor({
  threshold: { cpu: 80, memory: 90, disk: 85 },
  alertCooldownMs: 120_000,
});

monitor.on('cpu-high', (value) => {
  console.error(`CPU critical: ${value}%`);
});

monitor.on('memory-high', (value) => {
  pagerDuty.send({ severity: 'critical', metric: 'memory', value });
});
```

Alerts use **hysteresis**: they fire after 2 consecutive samples above threshold and clear when the value drops below `threshold - 5%`.

## Plugin Development

```typescript
monitor.use(myPlugin);
```

See [PLUGIN_GUIDE.md](./PLUGIN_GUIDE.md) for the full `MonitorPlugin` interface, lifecycle hooks, and a complete example.

## Docker Monitoring

Ensure the Docker socket is accessible:

```bash
# Linux / macOS
ls -la /var/run/docker.sock

# Or set DOCKER_HOST for remote/TCP
export DOCKER_HOST=tcp://127.0.0.1:2375
```

```typescript
const monitor = new Monitor({ enableDocker: true });
const stats = await monitor.getStats();
console.log(stats.docker.containers);
```

## Sub-path Exports

| Import | Description |
|---|---|
| `@myorg/monitor-core` | Core library |
| `@myorg/monitor-core/cli` | Terminal dashboard |
| `@myorg/monitor-core/prometheus` | Prometheus adapter |
| `@myorg/monitor-core/websocket` | WebSocket streaming |

## Terminal Dashboard

```bash
npx monitor
# or with custom interval
npx monitor --interval 2000
```

## Prometheus Export

```typescript
import { Monitor } from '@myorg/monitor-core';
import { createPrometheusAdapter } from '@myorg/monitor-core/prometheus';

const monitor = new Monitor();
const prom = createPrometheusAdapter(monitor);
prom.start();

const handler = prom.createMetricsRouter();
// Mount handler on GET /metrics
```

## WebSocket Streaming

```typescript
import { createWebSocketAdapter } from '@myorg/monitor-core/websocket';

const ws = createWebSocketAdapter(monitor, { port: 9100 });
await ws.start();
```

Clients subscribe via `{ "type": "subscribe", "namespaces": ["cpu", "memory"] }`.

## REST API

```typescript
import { createRestRouter } from '@myorg/monitor-core';

const router = createRestRouter(monitor);
// GET /stats, /metrics, /processes, /containers, /health
```

## Development

```bash
npm install
npm run build
npm test
npm run lint
npm run typecheck
```

## License

MIT © MyOrg
