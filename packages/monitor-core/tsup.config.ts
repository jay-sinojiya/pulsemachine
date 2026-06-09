// --- FILE: tsup.config.ts ---
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'cli/index': 'src/cli/index.ts',
    'adapters/prometheus.adapter': 'src/adapters/prometheus.adapter.ts',
    'adapters/websocket.adapter': 'src/adapters/websocket.adapter.ts',
    'adapters/rest.adapter': 'src/adapters/rest.adapter.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  target: 'node18',
  outDir: 'dist',
  external: ['os', 'fs', 'net', 'child_process', 'path', 'events', 'util', 'ws', 'prom-client', 'blessed'],
});
