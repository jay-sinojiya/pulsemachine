import React from 'react';
import { Activity } from 'lucide-react';
import { usePulseStream } from './hooks/usePulseStream';
import CpuChart from './components/CpuChart';
import MemoryChart from './components/MemoryChart';
import ProcessTable from './components/ProcessTable';
import './index.css';

// Chart.js requires registration of its components
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

function App() {
  const { stats, history, connected } = usePulseStream('ws://127.0.0.1:9100/ws');

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-title">
          <Activity size={32} color="var(--accent-cyan)" />
          Pulse Dashboard
        </div>
        <div className="status-badge">
          <div className={`status-dot ${connected ? 'connected' : ''}`}></div>
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </header>

      {stats ? (
        <main className="dashboard-grid">
          {/* Overview Section */}
          <div className="widget overview-widget">
            <div className="widget-header">
              System Overview
            </div>
            <div style={{ display: 'flex', gap: '2rem', color: 'var(--text-secondary)' }}>
              <div><strong>Cores:</strong> {stats.cpu.cores.length} Core(s)</div>
              <div><strong>Uptime:</strong> {Math.floor(stats.uptime?.uptimeSeconds || 0)}s</div>
              <div><strong>Load Avg:</strong> {stats.uptime?.loadAverage?.map(l => l.toFixed(2)).join(', ')}</div>
            </div>
          </div>

          {/* CPU Chart */}
          <div className="widget cpu-widget">
            <CpuChart history={history} currentStats={stats} />
          </div>

          {/* Memory Chart */}
          <div className="widget memory-widget">
            <MemoryChart currentStats={stats} />
          </div>

          {/* Process Table */}
          <div className="widget process-widget">
            <ProcessTable processes={stats.processes.topByCpu} />
          </div>
        </main>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '4rem', color: 'var(--text-secondary)' }}>
          {connected ? 'Waiting for metrics...' : 'Connecting to Pulse Machine...'}
        </div>
      )}
    </div>
  );
}

export default App;
