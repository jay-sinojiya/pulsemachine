// --- FILE: src/index.ts ---
export { Monitor, TOKENS } from './monitor.js';
export { Container } from './container.js';
export { AlertEngine } from './alerts/alert.engine.js';
export { buildDefaultRules, extractMetricValue } from './alerts/alert.rules.js';
export { BaseCollector } from './collectors/base.collector.js';
export { CpuCollector } from './collectors/cpu.collector.js';
export { MemoryCollector } from './collectors/memory.collector.js';
export { DiskCollector } from './collectors/disk.collector.js';
export { NetworkCollector } from './collectors/network.collector.js';
export { ProcessCollector } from './collectors/process.collector.js';
export { UptimeCollector } from './collectors/uptime.collector.js';
export { DockerCollector } from './collectors/docker.collector.js';
export { PluginRegistry } from './plugins/plugin.registry.js';
export { ExamplePlugin, createExamplePlugin } from './plugins/example.plugin.js';
export { WebSocketAdapter, createWebSocketAdapter } from './adapters/websocket.adapter.js';
export { PrometheusAdapter, createPrometheusAdapter } from './adapters/prometheus.adapter.js';
export {
  createRestRouter,
  createExpressMiddleware,
  registerFastifyRoutes,
} from './adapters/rest.adapter.js';
export { RingBuffer } from './utils/ringbuffer.js';
export {
  getPlatform,
  isLinux,
  isMacOS,
  isWindows,
  isSupportedPlatform,
  safeExec,
  safeReadFile,
  parseNumber,
  toPercent,
} from './utils/platform.js';
export { createDashboard, Dashboard } from './cli/dashboard.js';

export type {
  AlertSeverity,
  MetricNamespace,
  ThresholdConfig,
  MonitorOptions,
  CpuCoreMetrics,
  CpuMetrics,
  MemoryMetrics,
  DiskMountMetrics,
  DiskIoMetrics,
  DiskMetrics,
  NetworkInterfaceMetrics,
  NetworkMetrics,
  ProcessMetrics,
  ProcessListMetrics,
  DockerContainerMetrics,
  DockerMetrics,
  UptimeMetrics,
  SystemStats,
  ICollector,
  AlertEventPayload,
  MonitorAlertEvent,
  MonitorLifecycleEvent,
  MonitorEvent,
  MonitorEventMap,
  PluginLifecycle,
  MonitorPlugin,
  MonitorLike,
  WebSocketSubscription,
  RouteHandler,
  RestRequest,
  RestResponse,
  RestRouter,
  PrometheusAdapterOptions,
  WebSocketAdapterOptions,
  AlertRule,
  ContainerToken,
} from './types.js';
