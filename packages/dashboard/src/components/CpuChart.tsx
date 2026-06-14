import React from 'react';
import { Line } from 'react-chartjs-2';
import { Cpu } from 'lucide-react';
import type { PulseData } from '../hooks/usePulseStream';
import type { SystemStats } from 'pulsemachine';

interface CpuChartProps {
  history: PulseData['history'];
  currentStats: SystemStats;
}

const CpuChart: React.FC<CpuChartProps> = ({ history, currentStats }) => {
  const data = {
    labels: history.time,
    datasets: [
      {
        label: 'CPU Usage %',
        data: history.cpu,
        borderColor: 'var(--accent-cyan)',
        backgroundColor: 'rgba(34, 211, 238, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      x: {
        display: false,
        grid: { display: false },
      },
      y: {
        min: 0,
        max: 100,
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: 'var(--text-secondary)',
        },
      },
    },
    animation: {
      duration: 0,
    },
  };

  return (
    <>
      <div className="widget-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Cpu className="widget-icon" />
          CPU Usage
        </div>
        <div className="metric-value" style={{ color: 'var(--accent-cyan)' }}>
          {currentStats.cpu.averageUsagePercent.toFixed(1)}%
        </div>
      </div>
      <div className="chart-container">
        <Line data={data} options={options} />
      </div>
    </>
  );
};

export default CpuChart;
