// --- FILE: src/monitor.ts ---
import { EventEmitter } from 'events';
import { Container } from './container.js';
import { AlertEngine } from './alerts/alert.engine.js';
import { CpuCollector } from './collectors/cpu.collector.js';
import { MemoryCollector } from './collectors/memory.collector.js';
import { DiskCollector } from './collectors/disk.collector.js';
import { NetworkCollector } from './collectors/network.collector.js';
import { ProcessCollector } from './collectors/process.collector.js';
import { UptimeCollector } from './collectors/uptime.collector.js';
import { DockerCollector } from './collectors/docker.collector.js';
import { PluginRegistry } from './plugins/plugin.registry.js';
import type {
  ContainerToken,
  MonitorEventMap,
  MonitorOptions,
  MonitorPlugin,
  SystemStats,
} from './types.js';

const DEFAULT_INTERVAL = 5000;
const DEFAULT_HISTORY_SIZE = 60;
const DEFAULT_PROCESS_LIMIT = 10;

export const TOKENS = {
  cpu: Container.createToken<CpuCollector>('cpu'),
  memory: Container.createToken<MemoryCollector>('memory'),
  disk: Container.createToken<DiskCollector>('disk'),
  network: Container.createToken<NetworkCollector>('network'),
  process: Container.createToken<ProcessCollector>('process'),
  uptime: Container.createToken<UptimeCollector>('uptime'),
  docker: Container.createToken<DockerCollector>('docker'),
  alertEngine: Container.createToken<AlertEngine>('alertEngine'),
} as const;

/**
 * Core monitoring orchestrator. Extends EventEmitter and coordinates
 * collectors, alerts, and plugins.
 */
export class Monitor extends EventEmitter {
  private readonly options: Required<
    Pick<MonitorOptions, 'interval' | 'historySize' | 'processLimit' | 'enableDocker' | 'alertCooldownMs'>
  > & { threshold: NonNullable<MonitorOptions['threshold']> };

  private readonly container = new Container();
  private readonly pluginRegistry = new PluginRegistry();
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private readonly watchers = new Set<(stats: SystemStats) => void>();
  private lastStats: SystemStats | null = null;

  constructor(options: MonitorOptions = {}) {
    super();
    this.options = {
      interval: options.interval ?? DEFAULT_INTERVAL,
      threshold: options.threshold ?? { cpu: 80, memory: 90, disk: 85 },
      historySize: options.historySize ?? DEFAULT_HISTORY_SIZE,
      processLimit: options.processLimit ?? DEFAULT_PROCESS_LIMIT,
      enableDocker: options.enableDocker ?? true,
      alertCooldownMs: options.alertCooldownMs ?? 60_000,
    };

    this.registerDependencies();
    this.pluginRegistry.attach(this);
  }

  /** Get the DI container for advanced usage */
  getContainer(): Container {
    return this.container;
  }

  /** Register a plugin */
  use(plugin: MonitorPlugin): void {
    this.pluginRegistry.register(plugin);
  }

  /** Typed event listener */
  override on<K extends keyof MonitorEventMap>(
    event: K,
    listener: (...args: MonitorEventMap[K]) => void,
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  /** Typed once listener */
  override once<K extends keyof MonitorEventMap>(
    event: K,
    listener: (...args: MonitorEventMap[K]) => void,
  ): this {
    return super.once(event, listener as (...args: unknown[]) => void);
  }

  /** Typed emit */
  override emit<K extends keyof MonitorEventMap>(
    event: K,
    ...args: MonitorEventMap[K]
  ): boolean {
    return super.emit(event, ...args);
  }

  /** Collect a one-shot snapshot of all metrics */
  async getStats(): Promise<SystemStats> {
    return this.collectAll();
  }

  /** Subscribe to polling updates. Returns unsubscribe function. */
  watch(callback: (stats: SystemStats) => void): () => void {
    this.watchers.add(callback);

    if (this.lastStats) {
      try {
        callback(this.lastStats);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.emit('error', err);
      }
    }

    return () => {
      this.watchers.delete(callback);
    };
  }

  /** Start periodic collection */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      await this.pluginRegistry.startAll();
      await this.tick();
      this.intervalHandle = setInterval(() => {
        void this.tick();
      }, this.options.interval);
      this.emit('started');
    } catch (error) {
      this.running = false;
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', err);
      throw err;
    }
  }

  /** Stop periodic collection */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    try {
      await this.pluginRegistry.stopAll();
      this.emit('stopped');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', err);
      throw err;
    }
  }

  /** Whether the monitor is currently running */
  isRunning(): boolean {
    return this.running;
  }

  /** Resolve a dependency from the container */
  resolve<T>(token: ContainerToken<T>): T {
    return this.container.resolve(token);
  }

  private registerDependencies(): void {
    this.container.register(TOKENS.cpu, () => new CpuCollector(this.options.historySize));
    this.container.register(TOKENS.memory, () => new MemoryCollector());
    this.container.register(TOKENS.disk, () => new DiskCollector());
    this.container.register(TOKENS.network, () => new NetworkCollector());
    this.container.register(
      TOKENS.process,
      () => new ProcessCollector(this.options.processLimit),
    );
    this.container.register(TOKENS.uptime, () => new UptimeCollector());
    this.container.register(
      TOKENS.docker,
      () => new DockerCollector(this.options.enableDocker),
    );
    this.container.register(TOKENS.alertEngine, () =>
      AlertEngine.fromThreshold(this.options.threshold, this.options.alertCooldownMs),
    );
  }

  private async collectAll(): Promise<SystemStats> {
    const cpu = this.container.resolve(TOKENS.cpu);
    const memory = this.container.resolve(TOKENS.memory);
    const disk = this.container.resolve(TOKENS.disk);
    const network = this.container.resolve(TOKENS.network);
    const process = this.container.resolve(TOKENS.process);
    const uptime = this.container.resolve(TOKENS.uptime);
    const docker = this.container.resolve(TOKENS.docker);

    const [cpuMetrics, memoryMetrics, diskMetrics, networkMetrics, processMetrics, uptimeMetrics, dockerMetrics] =
      await Promise.all([
        cpu.collect(),
        memory.collect(),
        disk.collect(),
        network.collect(),
        process.collect(),
        uptime.collect(),
        docker.collect(),
      ]);

    return {
      timestamp: Date.now(),
      cpu: cpuMetrics,
      memory: memoryMetrics,
      disk: diskMetrics,
      network: networkMetrics,
      processes: processMetrics,
      docker: dockerMetrics,
      uptime: uptimeMetrics,
    };
  }

  private async tick(): Promise<void> {
    try {
      const stats = await this.collectAll();
      this.lastStats = stats;

      const alertEngine = this.container.resolve(TOKENS.alertEngine);
      alertEngine.evaluate(stats);

      this.emit('stats', stats);

      for (const watcher of this.watchers) {
        try {
          watcher(stats);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.emit('error', err);
        }
      }

      await this.pluginRegistry.notifyStats(stats);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', err);
    }
  }
}
