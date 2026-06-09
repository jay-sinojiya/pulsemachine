// --- FILE: src/alerts/alert.rules.ts ---
import type { AlertRule, ThresholdConfig } from '../types.js';

const DEFAULT_HYSTERESIS = 5;
const DEFAULT_CONSECUTIVE_SAMPLES = 2;
const DEFAULT_COOLDOWN_MS = 60_000;

/**
 * Build default alert rules from threshold configuration.
 */
export function buildDefaultRules(
  threshold: ThresholdConfig,
  cooldownMs = DEFAULT_COOLDOWN_MS,
): AlertRule[] {
  const rules: AlertRule[] = [];

  if (threshold.cpu !== undefined) {
    rules.push({
      id: 'cpu-high',
      metric: 'cpu',
      threshold: threshold.cpu,
      hysteresisPercent: DEFAULT_HYSTERESIS,
      consecutiveSamples: DEFAULT_CONSECUTIVE_SAMPLES,
      cooldownMs,
      severity: threshold.cpu >= 90 ? 'critical' : 'warning',
      eventName: 'cpu-high',
    });
  }

  if (threshold.memory !== undefined) {
    rules.push({
      id: 'memory-high',
      metric: 'memory',
      threshold: threshold.memory,
      hysteresisPercent: DEFAULT_HYSTERESIS,
      consecutiveSamples: DEFAULT_CONSECUTIVE_SAMPLES,
      cooldownMs,
      severity: threshold.memory >= 95 ? 'critical' : 'warning',
      eventName: 'memory-high',
    });
  }

  if (threshold.disk !== undefined) {
    rules.push({
      id: 'disk-high',
      metric: 'disk',
      threshold: threshold.disk,
      hysteresisPercent: DEFAULT_HYSTERESIS,
      consecutiveSamples: DEFAULT_CONSECUTIVE_SAMPLES,
      cooldownMs,
      severity: threshold.disk >= 95 ? 'critical' : 'warning',
      eventName: 'disk-high',
    });
  }

  return rules;
}

/**
 * Extract metric value from system stats for a given rule metric type.
 */
export function extractMetricValue(
  metric: AlertRule['metric'],
  stats: {
    cpu: { averageUsagePercent: number };
    memory: { usagePercent: number };
    disk: { maxUsagePercent: number };
  },
): number {
  switch (metric) {
    case 'cpu':
      return stats.cpu.averageUsagePercent;
    case 'memory':
      return stats.memory.usagePercent;
    case 'disk':
      return stats.disk.maxUsagePercent;
    default:
      return 0;
  }
}
