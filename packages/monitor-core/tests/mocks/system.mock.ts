// --- FILE: tests/mocks/system.mock.ts ---
import type { SystemStats } from '../../src/types.js';

export const mockCpuInfo = [
  {
    model: 'Mock CPU 0',
    speed: 2400,
    times: { user: 100, nice: 0, sys: 50, idle: 850, irq: 0 },
  },
  {
    model: 'Mock CPU 1',
    speed: 2400,
    times: { user: 120, nice: 0, sys: 60, idle: 820, irq: 0 },
  },
];

export const mockMemInfo = `MemTotal:       16384000 kB
MemFree:         4096000 kB
MemAvailable:    8192000 kB
Buffers:          512000 kB
Cached:          2560000 kB
SwapTotal:       8388608 kB
SwapFree:        4194304 kB`;

export const mockDfOutput = `Filesystem     1024-blocks     Used Available Capacity Mounted on
/dev/sda1       104857600 52428800  52428800      50% /
/dev/sdb1       209715200 104857600 104857600      50% /data`;

export const mockProcNetDev = `Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
  eth0: 1000000    5000    0    0    0     0          0         0  2000000    3000    0    0    0     0       0          0
    lo: 100000    1000    0    0    0     0          0         0   100000    1000    0    0    0     0       0          0`;

export const mockPsOutput = `USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
root 1 5.0 2.0 100000 50000 ? Ss 00:00 0:01 systemd
root 100 25.0 10.0 200000 100000 ? S 00:01 0:05 node`;

export function createMockSystemStats(overrides: Partial<SystemStats> = {}): SystemStats {
  const defaults: SystemStats = {
    timestamp: Date.now(),
    cpu: {
      cores: [{ core: 0, usagePercent: 50, speedMhz: 2400 }],
      averageUsagePercent: 50,
      frequencyMhz: 2400,
      temperatureCelsius: null,
      history: [50],
      available: true,
    },
    memory: {
      totalBytes: 16_000_000_000,
      usedBytes: 8_000_000_000,
      freeBytes: 8_000_000_000,
      cachedBytes: 2_000_000_000,
      usagePercent: 50,
      swapTotalBytes: 8_000_000_000,
      swapUsedBytes: 4_000_000_000,
      swapUsagePercent: 50,
      pressure: 'low',
      available: true,
    },
    disk: {
      mounts: [{ mount: '/', filesystem: '/dev/sda1', totalBytes: 100, usedBytes: 50, freeBytes: 50, usagePercent: 50 }],
      io: [],
      maxUsagePercent: 50,
      available: true,
    },
    network: {
      interfaces: [],
      available: true,
    },
    processes: {
      topByCpu: [],
      topByMemory: [],
      available: true,
    },
    docker: {
      containers: [],
      available: false,
      error: null,
    },
    uptime: {
      uptimeSeconds: 3600,
      loadAverage: [1.0, 0.5, 0.25],
      available: true,
    },
  };

  return { ...defaults, ...overrides };
}
