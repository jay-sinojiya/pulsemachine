// --- FILE: tests/plugins/plugin.registry.test.ts ---
import { describe, it, expect, vi } from 'vitest';
import { PluginRegistry } from '../../src/plugins/plugin.registry.js';
import type { MonitorLike, MonitorPlugin } from '../../src/types.js';
import { EventEmitter } from 'events';
import { createMockSystemStats } from '../mocks/system.mock.js';

function createMockMonitor(): MonitorLike {
  const emitter = new EventEmitter();
  return {
    getStats: vi.fn().mockResolvedValue(createMockSystemStats()),
    watch: vi.fn().mockReturnValue(() => {}),
    use: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    on: emitter.on.bind(emitter),
    emit: emitter.emit.bind(emitter),
  } as unknown as MonitorLike;
}

describe('PluginRegistry', () => {
  it('should register and install plugins', () => {
    const registry = new PluginRegistry();
    const monitor = createMockMonitor();
    const install = vi.fn();

    const plugin: MonitorPlugin = {
      name: 'test',
      version: '1.0.0',
      install,
    };

    registry.attach(monitor);
    registry.register(plugin);

    expect(install).toHaveBeenCalledWith(monitor);
    expect(registry.list()).toHaveLength(1);
  });

  it('should throw on duplicate plugin names', () => {
    const registry = new PluginRegistry();
    const plugin: MonitorPlugin = {
      name: 'dup',
      version: '1.0.0',
      install: vi.fn(),
    };

    registry.register(plugin);
    expect(() => { registry.register(plugin); }).toThrow('already registered');
  });

  it('should call lifecycle hooks', async () => {
    const registry = new PluginRegistry();
    const onStart = vi.fn();
    const onStop = vi.fn();
    const onStats = vi.fn();

    registry.register({
      name: 'lifecycle',
      version: '1.0.0',
      install: vi.fn(),
      onStart,
      onStop,
      onStats,
    });

    await registry.startAll();
    expect(onStart).toHaveBeenCalledOnce();

    const stats = createMockSystemStats();
    await registry.notifyStats(stats);
    expect(onStats).toHaveBeenCalledWith(stats);

    await registry.stopAll();
    expect(onStop).toHaveBeenCalledOnce();
  });

  it('should get plugin by name and clear registry', () => {
    const registry = new PluginRegistry();
    const plugin: MonitorPlugin = {
      name: 'lookup',
      version: '1.0.0',
      install: vi.fn(),
    };

    registry.register(plugin);
    expect(registry.get('lookup')).toBe(plugin);
    expect(registry.get('missing')).toBeUndefined();

    registry.clear();
    expect(registry.list()).toHaveLength(0);
  });

  it('should install plugin when attached after registration', () => {
    const registry = new PluginRegistry();
    const install = vi.fn();
    registry.register({
      name: 'late',
      version: '1.0.0',
      install,
    });

    registry.attach(createMockMonitor());
    expect(install).toHaveBeenCalled();
  });

  it('should handle plugin hook errors gracefully', async () => {
    const registry = new PluginRegistry();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    registry.register({
      name: 'failing',
      version: '1.0.0',
      install: vi.fn(),
      onStart: () => {
        throw new Error('boom');
      },
    });

    await registry.startAll();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
