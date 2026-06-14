import { Monitor } from 'pulsemachine';
import { createWebSocketAdapter } from 'pulsemachine/websocket';

async function main() {
  console.log('Starting Pulse Machine local dev server...');
  
  // Create monitor instance
  const monitor = new Monitor({
    interval: 1000, // 1s updates for dashboard feel
    enableDocker: false, // disable docker for dev to avoid errors if not running
  });

  // Create and attach websocket adapter
  const ws = createWebSocketAdapter(monitor, { port: 9100 });
  await ws.start();

  // Start polling
  await monitor.start();

  console.log(`WebSocket server running on ws://localhost:9100`);
}

main().catch(console.error);
