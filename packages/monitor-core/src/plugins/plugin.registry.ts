// --- FILE: src/plugins/plugin.registry.ts ---
import type { MonitorLike, MonitorPlugin } from '../types.js';

/**
 * Registry for monitor plugins with lifecycle management.
 */
export class PluginRegistry {
  private readonly plugins = new Map<string, MonitorPlugin>();
  private monitor: MonitorLike | null = null;

  register(plugin: MonitorPlugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered`);
    }

    if (this.monitor) {
      plugin.install(this.monitor);
    }

    this.plugins.set(plugin.name, plugin);
  }

  attach(monitor: MonitorLike): void {
    this.monitor = monitor;
    for (const plugin of this.plugins.values()) {
      plugin.install(monitor);
    }
  }

  async startAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.onStart) {
        try {
          await plugin.onStart();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`[monitor-core] Plugin "${plugin.name}" onStart failed: ${message}`);
        }
      }
    }
  }

  async stopAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.onStop) {
        try {
          await plugin.onStop();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`[monitor-core] Plugin "${plugin.name}" onStop failed: ${message}`);
        }
      }
    }
  }

  async notifyStats(stats: import('../types.js').SystemStats): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.onStats) {
        try {
          await plugin.onStats(stats);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`[monitor-core] Plugin "${plugin.name}" onStats failed: ${message}`);
        }
      }
    }
  }

  get(name: string): MonitorPlugin | undefined {
    return this.plugins.get(name);
  }

  list(): MonitorPlugin[] {
    return [...this.plugins.values()];
  }

  clear(): void {
    this.plugins.clear();
    this.monitor = null;
  }
}
