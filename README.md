# Pulse Machine

This repository contains the `pulsemachine` system monitoring library. 

## Project Structure

This project is a monorepo containing two main packages:
- `packages/monitor-core` - The core system monitoring library and terminal CLI.
- `packages/dashboard` - The real-time React web dashboard.

## Quick Start

### 1. Web Dashboard (Recommended)

To run the modern, real-time web dashboard locally, you need to start both the local WebSocket server and the UI:

**Terminal 1 (Data Server):**
```bash
cd packages/dashboard
npm run dev:server
```

**Terminal 2 (Web UI):**
```bash
cd packages/dashboard
npm install
npm run dev
```

Then open `http://localhost:5173` in your browser.

### 2. Terminal CLI

To build and run the original terminal-based monitoring dashboard locally:

```bash
cd packages/monitor-core
npm install
npm run build
npm link
pulsemachine
```

For more details, see the [Monitor Core README](./packages/monitor-core/README.md).
