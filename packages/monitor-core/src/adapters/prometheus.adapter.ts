// --- FILE: src/adapters/prometheus.adapter.ts ---
import { Registry, Gauge, Counter, collectDefaultMetrics } from 'prom-client';
import type { Monitor } from '../monitor.js';
import type { PrometheusAdapterOptions, RestRequest, RestResponse, SystemStats } from '../types.js';

/**
 * Prometheus metrics exporter using prom-client.
 * Registers all system metrics as Gauges/Counters and exposes /metrics endpoint.
 */
export class PrometheusAdapter {
  private readonly monitor: Monitor;
  private readonly registry: Registry;
  private readonly prefix: string;
  private readonly labels: Record<string, string>;
  private unsubscribe: (() => void) | null = null;

  private cpuGauge!: Gauge;
  private cpuCoreGauge!: Gauge;
  private memoryGauge!: Gauge;
  private memoryBytesGauge!: Gauge;
  private swapGauge!: Gauge;
  private diskUsageGauge!: Gauge;
  private diskReadCounter!: Counter;
  private diskWriteCounter!: Counter;
  private networkRxCounter!: Counter;
  private networkTxCounter!: Counter;
  private processCpuGauge!: Gauge;
  private processMemGauge!: Gauge;
  private containerCpuGauge!: Gauge;
  private containerMemGauge!: Gauge;
  private uptimeGauge!: Gauge;

  constructor(monitor: Monitor, options: PrometheusAdapterOptions = {}) {
    this.monitor = monitor;
    this.registry = new Registry();
    this.prefix = options.prefix ?? 'monitor';
    this.labels = options.labels ?? {};
    this.initMetrics();
    collectDefaultMetrics({ register: this.registry, prefix: this.prefix });
  }

  /** Start syncing metrics from monitor */
  start(): void {
    this.unsubscribe = this.monitor.watch((stats) => {
      this.updateMetrics(stats);
    });
  }

  /** Stop syncing metrics */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  getRegistry(): Registry {
    return this.registry;
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /** Create an express-compatible /metrics route handler */
  createMetricsRouter(): (req: RestRequest, res: RestResponse) => Promise<void> {
    return async (_req: RestRequest, res: RestResponse) => {
      try {
        const stats = await this.monitor.getStats();
        this.updateMetrics(stats);
        const metrics = await this.getMetrics();
        res.setHeader('Content-Type', this.registry.contentType);
        res.status(200);
        res.end(metrics);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal error';
        res.status(500);
        res.json({ error: message });
      }
    };
  }

  private initMetrics(): void {
    const labelNames = Object.keys(this.labels);

    this.cpuGauge = new Gauge({
      name: `${this.prefix}_cpu_usage_percent`,
      help: 'Average CPU usage percentage',
      labelNames,
      registers: [this.registry],
    });

    this.cpuCoreGauge = new Gauge({
      name: `${this.prefix}_cpu_core_usage_percent`,
      help: 'Per-core CPU usage percentage',
      labelNames: [...labelNames, 'core'],
      registers: [this.registry],
    });

    this.memoryGauge = new Gauge({
      name: `${this.prefix}_memory_usage_percent`,
      help: 'Memory usage percentage',
      labelNames,
      registers: [this.registry],
    });

    this.memoryBytesGauge = new Gauge({
      name: `${this.prefix}_memory_bytes`,
      help: 'Memory bytes',
      labelNames: [...labelNames, 'type'],
      registers: [this.registry],
    });

    this.swapGauge = new Gauge({
      name: `${this.prefix}_swap_usage_percent`,
      help: 'Swap usage percentage',
      labelNames,
      registers: [this.registry],
    });

    this.diskUsageGauge = new Gauge({
      name: `${this.prefix}_disk_usage_percent`,
      help: 'Disk usage percentage per mount',
      labelNames: [...labelNames, 'mount'],
      registers: [this.registry],
    });

    this.diskReadCounter = new Counter({
      name: `${this.prefix}_disk_read_bytes_total`,
      help: 'Total disk read bytes',
      labelNames: [...labelNames, 'device'],
      registers: [this.registry],
    });

    this.diskWriteCounter = new Counter({
      name: `${this.prefix}_disk_write_bytes_total`,
      help: 'Total disk write bytes',
      labelNames: [...labelNames, 'device'],
      registers: [this.registry],
    });

    this.networkRxCounter = new Counter({
      name: `${this.prefix}_network_rx_bytes_total`,
      help: 'Total network received bytes',
      labelNames: [...labelNames, 'interface'],
      registers: [this.registry],
    });

    this.networkTxCounter = new Counter({
      name: `${this.prefix}_network_tx_bytes_total`,
      help: 'Total network transmitted bytes',
      labelNames: [...labelNames, 'interface'],
      registers: [this.registry],
    });

    this.processCpuGauge = new Gauge({
      name: `${this.prefix}_process_cpu_percent`,
      help: 'Process CPU usage percentage',
      labelNames: [...labelNames, 'pid', 'name'],
      registers: [this.registry],
    });

    this.processMemGauge = new Gauge({
      name: `${this.prefix}_process_memory_percent`,
      help: 'Process memory usage percentage',
      labelNames: [...labelNames, 'pid', 'name'],
      registers: [this.registry],
    });

    this.containerCpuGauge = new Gauge({
      name: `${this.prefix}_container_cpu_percent`,
      help: 'Docker container CPU usage percentage',
      labelNames: [...labelNames, 'container', 'id'],
      registers: [this.registry],
    });

    this.containerMemGauge = new Gauge({
      name: `${this.prefix}_container_memory_percent`,
      help: 'Docker container memory usage percentage',
      labelNames: [...labelNames, 'container', 'id'],
      registers: [this.registry],
    });

    this.uptimeGauge = new Gauge({
      name: `${this.prefix}_uptime_seconds`,
      help: 'System uptime in seconds',
      labelNames,
      registers: [this.registry],
    });
  }

  private updateMetrics(stats: SystemStats): void {
    this.cpuGauge.set(this.labels, stats.cpu.averageUsagePercent);

    for (const core of stats.cpu.cores) {
      this.cpuCoreGauge.set(
        { ...this.labels, core: String(core.core) },
        core.usagePercent,
      );
    }

    this.memoryGauge.set(this.labels, stats.memory.usagePercent);
    this.memoryBytesGauge.set({ ...this.labels, type: 'total' }, stats.memory.totalBytes);
    this.memoryBytesGauge.set({ ...this.labels, type: 'used' }, stats.memory.usedBytes);
    this.memoryBytesGauge.set({ ...this.labels, type: 'free' }, stats.memory.freeBytes);
    this.memoryBytesGauge.set({ ...this.labels, type: 'cached' }, stats.memory.cachedBytes);
    this.swapGauge.set(this.labels, stats.memory.swapUsagePercent);

    for (const mount of stats.disk.mounts) {
      this.diskUsageGauge.set({ ...this.labels, mount: mount.mount }, mount.usagePercent);
    }

    for (const io of stats.disk.io) {
      if (io.readBytesPerSec > 0) {
        this.diskReadCounter.inc({ ...this.labels, device: io.device }, io.readBytesPerSec);
      }
      if (io.writeBytesPerSec > 0) {
        this.diskWriteCounter.inc({ ...this.labels, device: io.device }, io.writeBytesPerSec);
      }
    }

    for (const iface of stats.network.interfaces) {
      if (iface.rxBytes > 0) {
        this.networkRxCounter.inc(
          { ...this.labels, interface: iface.interface },
          iface.rxBytes,
        );
      }
      if (iface.txBytes > 0) {
        this.networkTxCounter.inc(
          { ...this.labels, interface: iface.interface },
          iface.txBytes,
        );
      }
    }

    for (const proc of stats.processes.topByCpu) {
      this.processCpuGauge.set(
        { ...this.labels, pid: String(proc.pid), name: proc.name },
        proc.cpuPercent,
      );
    }

    for (const proc of stats.processes.topByMemory) {
      this.processMemGauge.set(
        { ...this.labels, pid: String(proc.pid), name: proc.name },
        proc.memoryPercent,
      );
    }

    for (const container of stats.docker.containers) {
      this.containerCpuGauge.set(
        { ...this.labels, container: container.name, id: container.id },
        container.cpuPercent,
      );
      this.containerMemGauge.set(
        { ...this.labels, container: container.name, id: container.id },
        container.memoryPercent,
      );
    }

    this.uptimeGauge.set(this.labels, stats.uptime.uptimeSeconds);
  }
}

export function createPrometheusAdapter(
  monitor: Monitor,
  options?: PrometheusAdapterOptions,
): PrometheusAdapter {
  return new PrometheusAdapter(monitor, options);
}
