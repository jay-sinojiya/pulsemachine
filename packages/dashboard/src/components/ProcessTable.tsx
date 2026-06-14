import React from 'react';
import { List } from 'lucide-react';
import type { SystemStats } from 'pulsemachine';

interface ProcessTableProps {
  processes: SystemStats['processes']['topByCpu'];
}

const ProcessTable: React.FC<ProcessTableProps> = ({ processes }) => {
  // Sort by CPU usage primarily
  const sorted = [...processes].sort((a, b) => b.cpuPercent - a.cpuPercent).slice(0, 5);

  return (
    <>
      <div className="widget-header">
        <List className="widget-icon" style={{ color: 'var(--accent-blue)' }} />
        Top Processes
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>PID</th>
            <th>Name</th>
            <th>CPU %</th>
            <th>Memory %</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.pid}>
              <td style={{ color: 'var(--text-secondary)' }}>{p.pid}</td>
              <td style={{ fontWeight: 500 }}>{p.name}</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ width: '40px', textAlign: 'right' }}>{p.cpuPercent.toFixed(1)}</span>
                  <div className="progress-bar-bg" style={{ flex: 1 }}>
                    <div 
                      className="progress-bar-fill" 
                      style={{ width: `${Math.min(p.cpuPercent, 100)}%` }}
                    />
                  </div>
                </div>
              </td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ width: '40px', textAlign: 'right' }}>{p.memoryPercent.toFixed(1)}</span>
                  <div className="progress-bar-bg" style={{ flex: 1 }}>
                    <div 
                      className="progress-bar-fill" 
                      style={{ width: `${Math.min(p.memoryPercent, 100)}%`, background: 'var(--accent-purple)' }}
                    />
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};

export default ProcessTable;
