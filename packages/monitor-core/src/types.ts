// --- FILE: src/types.ts ---
import type { EventEmitter } from 'events';

/** Severity levels for threshold alerts */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/** Supported metric namespaces for subscriptions */
export type MetricNamespace =
  | 'cpu'
  | 'memory'
  | 'disk'
  | 'network'
  | 'process'
  | 'docker'
  | 'uptime'
  | 'all';

/** Threshold configuration for built-in alerts */
export interface ThresholdConfig {
  cpu?: number;
  memory?: number;
  disk?: number;
}

/** Monitor configuration options */
export interface MonitorOptions {
  /** Polling interval in milliseconds (default: 5000) */
  interval?: number;
  /** Threshold percentages for built-in alerts */
  threshold?: ThresholdConfig;
  /** Number of historical samples to retain per metric */
  historySize?: number;
  /** Top-N processes to collect (default: 10) */
  processLimit?: number;
  /** Enable Docker container collection (default: true) */
  enableDocker?: boolean;
  /** Alert cooldown period in milliseconds (default: 60000) */
  alertCooldownMs?: number;
}

/** Per-core CPU metrics */
export interface CpuCoreMetrics {
  core: number;
  usagePercent: number;
  speedMhz: number;
}

/** CPU metrics snapshot */
export interface CpuMetrics {
  cores: CpuCoreMetrics[];
  averageUsagePercent: number;
  frequencyMhz: number;
  temperatureCelsius: number | null;
  history: number[];
  available: boolean;
}

/** Memory metrics snapshot */
export interface MemoryMetrics {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  cachedBytes: number;
  usagePercent: number;
  swapTotalBytes: number;
  swapUsedBytes: number;
  swapUsagePercent: number;
  pressure: 'low' | 'medium' | 'high';
  available: boolean;
}

/** Per-mount disk metrics */
export interface DiskMountMetrics {
  mount: string;
  filesystem: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usagePercent: number;
}

/** Disk I/O metrics */
export interface DiskIoMetrics {
  device: string;
  readIops: number;
  writeIops: number;
  readBytesPerSec: number;
  writeBytesPerSec: number;
}

/** Disk metrics snapshot */
export interface DiskMetrics {
  mounts: DiskMountMetrics[];
  io: DiskIoMetrics[];
  maxUsagePercent: number;
  available: boolean;
}

/** Per-interface network metrics */
export interface NetworkInterfaceMetrics {
  interface: string;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  rxErrors: number;
  txErrors: number;
  rxDrops: number;
  txDrops: number;
  speedMbps: number | null;
  rxBytesPerSec: number;
  txBytesPerSec: number;
}

/** Network metrics snapshot */
export interface NetworkMetrics {
  interfaces: NetworkInterfaceMetrics[];
  available: boolean;
}

/** Process metrics entry */
export interface ProcessMetrics {
  pid: number;
  name: string;
  user: string;
  state: string;
  cpuPercent: number;
  memoryPercent: number;
  memoryBytes: number;
}

/** Process metrics snapshot */
export interface ProcessListMetrics {
  topByCpu: ProcessMetrics[];
  topByMemory: ProcessMetrics[];
  available: boolean;
}

/** Docker container metrics */
export interface DockerContainerMetrics {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  cpuPercent: number;
  memoryUsageBytes: number;
  memoryLimitBytes: number;
  memoryPercent: number;
  networkRxBytes: number;
  networkTxBytes: number;
  blockReadBytes: number;
  blockWriteBytes: number;
}

/** Docker metrics snapshot */
export interface DockerMetrics {
  containers: DockerContainerMetrics[];
  available: boolean;
  error: string | null;
}

/** Uptime metrics snapshot */
export interface UptimeMetrics {
  uptimeSeconds: number;
  loadAverage: number[];
  available: boolean;
}

/** Complete system stats snapshot */
export interface SystemStats {
  timestamp: number;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics;
  network: NetworkMetrics;
  processes: ProcessListMetrics;
  docker: DockerMetrics;
  uptime: UptimeMetrics;
}

/** Collector interface — every metric source implements this */
export interface ICollector<T> {
  readonly name: string;
  collect(): Promise<T>;
  isSupported(): boolean;
}

/** Alert event payload */
export interface AlertEventPayload {
  metric: string;
  value: number;
  threshold: number;
  severity: AlertSeverity;
  timestamp: number;
}

/** Built-in alert event names */
export type MonitorAlertEvent = 'cpu-high' | 'memory-high' | 'disk-high';

/** Monitor lifecycle events */
export type MonitorLifecycleEvent = 'started' | 'stopped' | 'error' | 'stats';

/** All monitor events */
export type MonitorEvent = MonitorAlertEvent | MonitorLifecycleEvent;

/** Typed event map for Monitor */
export interface MonitorEventMap {
  'cpu-high': [value: number];
  'memory-high': [value: number];
  'disk-high': [value: number];
  started: [];
  stopped: [];
  error: [error: Error];
  stats: [stats: SystemStats];
}

/** Plugin lifecycle hooks */
export interface PluginLifecycle {
  onStart?(): void | Promise<void>;
  onStop?(): void | Promise<void>;
  onStats?(stats: SystemStats): void | Promise<void>;
}

/** Monitor plugin interface */
export interface MonitorPlugin extends PluginLifecycle {
  name: string;
  version: string;
  install(monitor: MonitorLike): void;
}

/** Minimal monitor surface exposed to plugins */
export interface MonitorLike extends EventEmitter {
  getStats(): Promise<SystemStats>;
  watch(callback: (stats: SystemStats) => void): () => void;
  use(plugin: MonitorPlugin): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}

/** WebSocket subscription filter */
export interface WebSocketSubscription {
  namespaces: MetricNamespace[];
}

/** REST route handler signature (framework-agnostic) */
export type RouteHandler = (
  req: RestRequest,
  res: RestResponse,
) => void | Promise<void>;

/** Minimal REST request interface */
export interface RestRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
}

/** Minimal REST response interface */
export interface RestResponse {
  status(code: number): RestResponse;
  json(data: unknown): void;
  setHeader(name: string, value: string): void;
  end(data?: string): void;
}

/** REST router factory result */
export interface RestRouter {
  handle(req: RestRequest, res: RestResponse): Promise<boolean>;
  routes: Map<string, RouteHandler>;
}

/** Prometheus adapter options */
export interface PrometheusAdapterOptions {
  prefix?: string;
  labels?: Record<string, string>;
}

/** WebSocket adapter options */
export interface WebSocketAdapterOptions {
  port?: number;
  host?: string;
  heartbeatIntervalMs?: number;
  path?: string;
}

/** Alert rule definition */
export interface AlertRule {
  id: string;
  metric: 'cpu' | 'memory' | 'disk';
  threshold: number;
  hysteresisPercent?: number;
  consecutiveSamples?: number;
  cooldownMs?: number;
  severity: AlertSeverity;
  eventName: MonitorAlertEvent;
}

/** Container token type */
export type ContainerToken<T> = symbol & { __type?: T };
