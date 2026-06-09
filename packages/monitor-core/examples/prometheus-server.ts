// --- FILE: examples/prometheus-server.ts ---
import { createServer } from 'http';
import { Monitor } from '../src/index.js';
import { createPrometheusAdapter } from '../src/adapters/prometheus.adapter.js';
import { createRestRouter } from '../src/adapters/rest.adapter.js';

async function main(): Promise<void> {
  const port = Number(process.env['PORT'] ?? 9090);

  const monitor = new Monitor({
    interval: 5000,
    threshold: { cpu: 80, memory: 90, disk: 85 },
  });

  const prometheus = createPrometheusAdapter(monitor, { prefix: 'monitor' });
  prometheus.start();

  const router = createRestRouter(monitor);
  await monitor.start();

  const server = createServer((req, res) => {
    void (async () => {
    const restReq = {
      method: req.method ?? 'GET',
      url: req.url ?? '/',
      headers: req.headers as Record<string, string | string[] | undefined>,
      query: {},
    };

    const restRes = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        res.statusCode = code;
        return this;
      },
      json(data: unknown) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      },
      setHeader(name: string, value: string) {
        res.setHeader(name, value);
      },
      end(data?: string) {
        res.end(data);
      },
    };

    const handled = await router.handle(restReq, restRes);
    if (!handled) {
      res.statusCode = 404;
      res.end('Not Found');
    }
    })();
  });

  server.listen(port, () => {
    console.log(`Prometheus metrics available at http://localhost:${String(port)}/metrics`);
    console.log(`Stats API available at http://localhost:${String(port)}/stats`);
  });

  process.on('SIGINT', () => {
    void monitor.stop().then(() => {
      server.close();
      process.exit(0);
    });
  });
}

void main();
