// --- FILE: src/alerts/alert.engine.ts ---
import { EventEmitter } from 'events';
import type { AlertEventPayload, AlertRule, SystemStats } from '../types.js';
import { buildDefaultRules, extractMetricValue } from './alert.rules.js';

interface RuleState {
  consecutiveBreaches: number;
  isActive: boolean;
  lastFiredAt: number;
}

/**
 * Threshold-based alert engine with hysteresis, consecutive sample
 * confirmation, and cooldown periods.
 */
export class AlertEngine extends EventEmitter {
  private rules: AlertRule[] = [];
  private readonly ruleStates = new Map<string, RuleState>();

  constructor(rules: AlertRule[] = []) {
    super();
    this.rules = rules;
    for (const rule of rules) {
      this.ruleStates.set(rule.id, {
        consecutiveBreaches: 0,
        isActive: false,
        lastFiredAt: 0,
      });
    }
  }

  static fromThreshold(
    threshold: { cpu?: number; memory?: number; disk?: number },
    cooldownMs?: number,
  ): AlertEngine {
    return new AlertEngine(buildDefaultRules(threshold, cooldownMs));
  }

  setRules(rules: AlertRule[]): void {
    this.rules = rules;
    this.ruleStates.clear();
    for (const rule of rules) {
      this.ruleStates.set(rule.id, {
        consecutiveBreaches: 0,
        isActive: false,
        lastFiredAt: 0,
      });
    }
  }

  getRules(): AlertRule[] {
    return [...this.rules];
  }

  /**
   * Process a stats snapshot and emit alert events as needed.
   */
  evaluate(stats: SystemStats): AlertEventPayload[] {
    const fired: AlertEventPayload[] = [];

    for (const rule of this.rules) {
      const state = this.ruleStates.get(rule.id);
      if (!state) {
        continue;
      }

      const value = extractMetricValue(rule.metric, stats);
      const hysteresis = rule.hysteresisPercent ?? 5;
      const consecutiveRequired = rule.consecutiveSamples ?? 2;
      const cooldownMs = rule.cooldownMs ?? 60_000;
      const clearThreshold = rule.threshold - hysteresis;

      if (value >= rule.threshold) {
        state.consecutiveBreaches++;

        if (
          !state.isActive &&
          state.consecutiveBreaches >= consecutiveRequired &&
          Date.now() - state.lastFiredAt >= cooldownMs
        ) {
          state.isActive = true;
          state.lastFiredAt = Date.now();

          const payload: AlertEventPayload = {
            metric: rule.metric,
            value,
            threshold: rule.threshold,
            severity: rule.severity,
            timestamp: stats.timestamp,
          };

          fired.push(payload);
          this.emit(rule.eventName, value);
          this.emit('alert', payload);
        }
      } else if (value < clearThreshold) {
        state.consecutiveBreaches = 0;

        if (state.isActive) {
          state.isActive = false;
          this.emit(`${rule.eventName}:cleared`, value);
          this.emit('alert:cleared', {
            metric: rule.metric,
            value,
            threshold: rule.threshold,
            severity: rule.severity,
            timestamp: stats.timestamp,
          });
        }
      } else {
        if (!state.isActive) {
          state.consecutiveBreaches = 0;
        }
      }
    }

    return fired;
  }

  reset(): void {
    for (const state of this.ruleStates.values()) {
      state.consecutiveBreaches = 0;
      state.isActive = false;
      state.lastFiredAt = 0;
    }
  }
}
