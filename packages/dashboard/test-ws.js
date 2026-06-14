import { WebSocket } from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9100');

ws.on('open', () => {
  console.log('Connected to WebSocket!');
  ws.send(JSON.stringify({ type: 'subscribe', namespaces: ['all'] }));
});

ws.on('message', (data) => {
  console.log('Received data:', data.toString().slice(0, 100) + '...');
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('WS Error:', err);
  process.exit(1);
});

setTimeout(() => {
  console.log('Timeout');
  process.exit(1);
}, 5000);
