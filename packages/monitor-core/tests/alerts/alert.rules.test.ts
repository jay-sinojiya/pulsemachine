// --- FILE: tests/alerts/alert.rules.test.ts ---
import { describe, it, expect } from 'vitest';
import { buildDefaultRules, extractMetricValue } from '../../src/alerts/alert.rules.js';
import { createMockSystemStats } from '../mocks/system.mock.js';

describe('alert.rules', () => {
  it('should build rules from threshold config', () => {
    const rules = buildDefaultRules({ cpu: 80, memory: 90, disk: 85 }, 30_000);

    expect(rules).toHaveLength(3);
    expect(rules[0]?.eventName).toBe('cpu-high');
    expect(rules[0]?.cooldownMs).toBe(30_000);
  });

  it('should set critical severity for high thresholds', () => {
    const rules = buildDefaultRules({ cpu: 95, memory: 96, disk: 97 });
    expect(rules.every((r) => r.severity === 'critical')).toBe(true);
  });

  it('should extract metric values from stats', () => {
    const stats = createMockSystemStats();

    expect(extractMetricValue('cpu', stats)).toBe(50);
    expect(extractMetricValue('memory', stats)).toBe(50);
    expect(extractMetricValue('disk', stats)).toBe(50);
  });
});
