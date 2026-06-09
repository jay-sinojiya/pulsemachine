// --- FILE: src/collectors/base.collector.ts ---
import type { ICollector } from '../types.js';

/**
 * Abstract base collector providing common error-handling wrapper.
 */
export abstract class BaseCollector<T> implements ICollector<T> {
  abstract readonly name: string;

  abstract isSupported(): boolean;

  protected abstract collectInternal(): Promise<T>;

  async collect(): Promise<T> {
    try {
      if (!this.isSupported()) {
        return this.getFallback();
      }
      return await this.collectInternal();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[monitor-core] Collector "${this.name}" failed: ${message}`);
      return this.getFallback();
    }
  }

  protected abstract getFallback(): T;
}
