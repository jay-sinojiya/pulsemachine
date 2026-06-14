# pulsemachine

[![npm version](https://img.shields.io/npm/v/pulsemachine.svg)](https://www.npmjs.com/package/pulsemachine)
[![build status](https://github.com/jay-sinojiya/pulsemachine/actions/workflows/ci.yml/badge.svg)](https://github.com/jay-sinojiya/pulsemachine/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/badge/coverage-%3E80%25-brightgreen)](https://github.com/jay-sinojiya/pulsemachine)
[![license](https://img.shields.io/npm/l/pulsemachine.svg)](https://github.com/jay-sinojiya/pulsemachine/blob/main/LICENSE)

Lightweight system monitoring library for Node.js — inspired by Grafana, Netdata, and PM2. Collect CPU, memory, disk, network, process, and Docker metrics with built-in alerts, Prometheus export, WebSocket streaming, and a terminal dashboard.

## Quick Start

```typescript
import { Monitor } from 'pulsemachine';

const monitor = new Monitor({ interval: 5000, threshold: { cpu: 80, memory: 90, disk: 85 } });
const stats = await monitor.getStats();
console.log(`CPU: ${stats.cpu.averageUsagePercent}%`);
```

Three lines to your first metric. Start continuous polling with `await monitor.start()`.

## Installation

```bash
npm install pulsemachine
```

Requires Node.js >= 18.0.0. Supports Linux, Windows, and macOS with graceful fallback when a metric is unavailable.

## Global Installation (Any PC)

To install and run the terminal dashboard globally on any computer:

```bash
npm install -g pulsemachine
pulsemachine
```

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
| `pulsemachine` | Core library |
| `pulsemachine/cli` | Terminal dashboard |
| `pulsemachine/prometheus` | Prometheus adapter |
| `pulsemachine/websocket` | WebSocket streaming |

## Terminal Dashboard

```bash
npx pulsemachine
# or with custom interval
npx pulsemachine --interval 2000

# check version
npx pulsemachine --version

# display advanced system information
npx pulsemachine --info
```

> **Note for Local Development:** If you are working within this repository and want to run the dashboard locally, you can build the project and link it:
> ```bash
> npm install
> npm run build
> npm link
> pulsemachine
> ```

## Prometheus Export

```typescript
import { Monitor } from 'pulsemachine';
import { createPrometheusAdapter } from 'pulsemachine/prometheus';

const monitor = new Monitor();
const prom = createPrometheusAdapter(monitor);
prom.start();

const handler = prom.createMetricsRouter();
// Mount handler on GET /metrics
```

## WebSocket Streaming

```typescript
import { createWebSocketAdapter } from 'pulsemachine/websocket';

const ws = createWebSocketAdapter(monitor, { port: 9100 });
await ws.start();
```

Clients subscribe via `{ "type": "subscribe", "namespaces": ["cpu", "memory"] }`.

## REST API

```typescript
import { createRestRouter } from 'pulsemachine';

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
