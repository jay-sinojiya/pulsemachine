// --- FILE: src/collectors/docker.collector.ts ---
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { BaseCollector } from './base.collector.js';
import { isWindows } from '../utils/platform.js';
import type { DockerMetrics, DockerContainerMetrics } from '../types.js';

interface DockerContainerJson {
  Id: string;
  Names: string[];
  Image: string;
  State: string;
  Status: string;
}

interface DockerStatsResponse {
  cpu_stats: {
    cpu_usage: { total_usage: number };
    system_cpu_usage: number;
    online_cpus: number;
  };
  precpu_stats: {
    cpu_usage: { total_usage: number };
    system_cpu_usage: number;
  };
  memory_stats: {
    usage?: number;
    limit?: number;
  };
  networks?: Record<string, { rx_bytes: number; tx_bytes: number }>;
  blkio_stats?: {
    io_service_bytes_recursive?: Array<{ op: string; value: number }>;
  };
}

function getDockerSocketPath(): string {
  if (isWindows()) {
    return process.env['DOCKER_HOST'] ?? 'npipe:////./pipe/docker_engine';
  }
  return process.env['DOCKER_HOST'] ?? '/var/run/docker.sock';
}

function dockerRequest(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const dockerHost = getDockerSocketPath();

    if (dockerHost.startsWith('http://') || dockerHost.startsWith('https://')) {
      const url = new URL(path, dockerHost);
      const requestFn = url.protocol === 'https:' ? httpsRequest : httpRequest;
      const req = requestFn(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname + url.search,
          method: 'GET',
          timeout: 5000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`Docker API returned status ${String(res.statusCode)}`));
            }
          });
        },
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Docker API request timed out'));
      });
      req.end();
      return;
    }

    const socketPath = dockerHost.replace('unix://', '');
    const req = httpRequest(
      {
        socketPath,
        path,
        method: 'GET',
        timeout: 5000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`Docker API returned status ${String(res.statusCode)}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Docker API request timed out'));
    });
    req.end();
  });
}

function calculateCpuPercent(stats: DockerStatsResponse): number {
  const cpuDelta =
    stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const onlineCpus = stats.cpu_stats.online_cpus || 1;

  if (systemDelta > 0 && cpuDelta > 0) {
    return Math.round((cpuDelta / systemDelta) * onlineCpus * 10000) / 100;
  }
  return 0;
}

function parseBlockIo(
  stats: DockerStatsResponse,
): { readBytes: number; writeBytes: number } {
  let readBytes = 0;
  let writeBytes = 0;
  const entries = stats.blkio_stats?.io_service_bytes_recursive ?? [];

  for (const entry of entries) {
    if (entry.op === 'Read') {
      readBytes += entry.value;
    } else if (entry.op === 'Write') {
      writeBytes += entry.value;
    }
  }

  return { readBytes, writeBytes };
}

function parseNetworkIo(stats: DockerStatsResponse): { rxBytes: number; txBytes: number } {
  let rxBytes = 0;
  let txBytes = 0;
  const networks = stats.networks ?? {};

  for (const net of Object.values(networks)) {
    rxBytes += net.rx_bytes;
    txBytes += net.tx_bytes;
  }

  return { rxBytes, txBytes };
}

async function fetchContainerStats(containerId: string): Promise<DockerContainerMetrics | null> {
  try {
    const statsJson = await dockerRequest(`/containers/${containerId}/stats?stream=false`);
    const stats = JSON.parse(statsJson) as DockerStatsResponse;
    const cpuPercent = calculateCpuPercent(stats);
    const memoryUsageBytes = stats.memory_stats.usage ?? 0;
    const memoryLimitBytes = stats.memory_stats.limit ?? 0;
    const memoryPercent =
      memoryLimitBytes > 0
        ? Math.round((memoryUsageBytes / memoryLimitBytes) * 10000) / 100
        : 0;
    const network = parseNetworkIo(stats);
    const block = parseBlockIo(stats);

    return {
      id: containerId.slice(0, 12),
      name: '',
      image: '',
      state: '',
      status: '',
      cpuPercent,
      memoryUsageBytes,
      memoryLimitBytes,
      memoryPercent,
      networkRxBytes: network.rxBytes,
      networkTxBytes: network.txBytes,
      blockReadBytes: block.readBytes,
      blockWriteBytes: block.writeBytes,
    };
  } catch {
    return null;
  }
}

export class DockerCollector extends BaseCollector<DockerMetrics> {
  readonly name = 'docker';

  private enabled: boolean;

  constructor(enabled = true) {
    super();
    this.enabled = enabled;
  }

  isSupported(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  protected getFallback(): DockerMetrics {
    return {
      containers: [],
      available: false,
      error: 'Docker collector unavailable',
    };
  }

  protected async collectInternal(): Promise<DockerMetrics> {
    try {
      const listJson = await dockerRequest('/containers/json');
      const containerList = JSON.parse(listJson) as DockerContainerJson[];

      const containers: DockerContainerMetrics[] = [];

      for (const container of containerList) {
        const stats = await fetchContainerStats(container.Id);
        const name = container.Names[0]?.replace(/^\//, '') ?? container.Id.slice(0, 12);

        if (stats !== null) {
          containers.push({
            ...stats,
            name,
            image: container.Image,
            state: container.State,
            status: container.Status,
          });
        } else {
          containers.push({
            id: container.Id.slice(0, 12),
            name,
            image: container.Image,
            state: container.State,
            status: container.Status,
            cpuPercent: 0,
            memoryUsageBytes: 0,
            memoryLimitBytes: 0,
            memoryPercent: 0,
            networkRxBytes: 0,
            networkTxBytes: 0,
            blockReadBytes: 0,
            blockWriteBytes: 0,
          });
        }
      }

      return {
        containers,
        available: true,
        error: null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        containers: [],
        available: false,
        error: message,
      };
    }
  }
}
