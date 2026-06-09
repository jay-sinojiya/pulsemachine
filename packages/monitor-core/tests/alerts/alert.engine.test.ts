// --- FILE: tests/alerts/alert.engine.test.ts ---
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AlertEngine } from '../../src/alerts/alert.engine.js';
import { createMockSystemStats } from '../mocks/system.mock.js';
import type { AlertRule } from '../../src/types.js';

describe('AlertEngine', () => {
  const rules: AlertRule[] = [
    {
      id: 'cpu-high',
      metric: 'cpu',
      threshold: 80,
      hysteresisPercent: 5,
      consecutiveSamples: 2,
      cooldownMs: 1000,
      severity: 'warning',
      eventName: 'cpu-high',
    },
    {
      id: 'memory-high',
      metric: 'memory',
      threshold: 90,
      hysteresisPercent: 5,
      consecutiveSamples: 2,
      cooldownMs: 1000,
      severity: 'critical',
      eventName: 'memory-high',
    },
  ];

  let engine: AlertEngine;

  beforeEach(() => {
    engine = new AlertEngine(rules);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not fire alert on single threshold breach (hysteresis)', () => {
    const handler = vi.fn();
    engine.on('cpu-high', handler);

    const stats = createMockSystemStats({
      cpu: {
        cores: [],
        averageUsagePercent: 85,
        frequencyMhz: 2400,
        temperatureCelsius: null,
        history: [],
        available: true,
      },
    });

    engine.evaluate(stats);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should fire alert after consecutive breaches', () => {
    const handler = vi.fn();
    engine.on('cpu-high', handler);

    const stats = createMockSystemStats({
      cpu: {
        cores: [],
        averageUsagePercent: 85,
        frequencyMhz: 2400,
        temperatureCelsius: null,
        history: [],
        available: true,
      },
    });

    engine.evaluate(stats);
    engine.evaluate(stats);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(85);
  });

  it('should clear alert when value drops below threshold minus hysteresis', () => {
    const fireHandler = vi.fn();
    const clearHandler = vi.fn();
    engine.on('cpu-high', fireHandler);
    engine.on('cpu-high:cleared', clearHandler);

    const highStats = createMockSystemStats({
      cpu: {
        cores: [],
        averageUsagePercent: 85,
        frequencyMhz: 2400,
        temperatureCelsius: null,
        history: [],
        available: true,
      },
    });

    engine.evaluate(highStats);
    engine.evaluate(highStats);
    expect(fireHandler).toHaveBeenCalledOnce();

    const lowStats = createMockSystemStats({
      cpu: {
        cores: [],
        averageUsagePercent: 70,
        frequencyMhz: 2400,
        temperatureCelsius: null,
        history: [],
        available: true,
      },
    });

    engine.evaluate(lowStats);
    expect(clearHandler).toHaveBeenCalledOnce();
  });

  it('should respect cooldown period', () => {
    const handler = vi.fn();
    engine.on('cpu-high', handler);

    const stats = createMockSystemStats({
      cpu: {
        cores: [],
        averageUsagePercent: 85,
        frequencyMhz: 2400,
        temperatureCelsius: null,
        history: [],
        available: true,
      },
    });

    engine.evaluate(stats);
    engine.evaluate(stats);
    expect(handler).toHaveBeenCalledOnce();

    engine.evaluate({ ...stats, timestamp: Date.now() + 100 });
    engine.evaluate({ ...stats, timestamp: Date.now() + 200 });
    expect(handler).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(1500);

    const clearedStats = createMockSystemStats({
      cpu: {
        cores: [],
        averageUsagePercent: 70,
        frequencyMhz: 2400,
        temperatureCelsius: null,
        history: [],
        available: true,
      },
    });
    engine.evaluate(clearedStats);

    engine.evaluate(stats);
    engine.evaluate(stats);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('should replace rules via setRules', () => {
    engine.setRules([]);
    expect(engine.getRules()).toHaveLength(0);

    engine.setRules(rules);
    expect(engine.getRules()).toHaveLength(2);
  });

  it('should create engine from threshold config', () => {
    const thresholdEngine = AlertEngine.fromThreshold({ cpu: 80, memory: 90, disk: 85 });
    expect(thresholdEngine.getRules()).toHaveLength(3);
  });

  it('should hold state in hysteresis dead band without clearing', () => {
    const clearHandler = vi.fn();
    engine.on('cpu-high:cleared', clearHandler);

    const highStats = createMockSystemStats({
      cpu: {
        cores: [],
        averageUsagePercent: 85,
        frequencyMhz: 2400,
        temperatureCelsius: null,
        history: [],
        available: true,
      },
    });

    engine.evaluate(highStats);
    engine.evaluate(highStats);

    const midStats = createMockSystemStats({
      cpu: {
        cores: [],
        averageUsagePercent: 78,
        frequencyMhz: 2400,
        temperatureCelsius: null,
        history: [],
        available: true,
      },
    });

    engine.evaluate(midStats);
    expect(clearHandler).not.toHaveBeenCalled();
  });

  it('should reset all rule states', () => {
    const handler = vi.fn();
    engine.on('cpu-high', handler);

    const stats = createMockSystemStats({
      cpu: {
        cores: [],
        averageUsagePercent: 85,
        frequencyMhz: 2400,
        temperatureCelsius: null,
        history: [],
        available: true,
      },
    });

    engine.evaluate(stats);
    engine.evaluate(stats);
    expect(handler).toHaveBeenCalledOnce();

    engine.reset();
    engine.evaluate(stats);
    engine.evaluate(stats);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('should emit alert payload on generic alert event', () => {
    const handler = vi.fn();
    engine.on('alert', handler);

    const stats = createMockSystemStats({
      memory: {
        totalBytes: 16_000_000_000,
        usedBytes: 15_000_000_000,
        freeBytes: 1_000_000_000,
        cachedBytes: 0,
        usagePercent: 95,
        swapTotalBytes: 0,
        swapUsedBytes: 0,
        swapUsagePercent: 0,
        pressure: 'high',
        available: true,
      },
    });

    engine.evaluate(stats);
    engine.evaluate(stats);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0]?.[0]).toMatchObject({
      metric: 'memory',
      value: 95,
      threshold: 90,
      severity: 'critical',
    });
  });
});
