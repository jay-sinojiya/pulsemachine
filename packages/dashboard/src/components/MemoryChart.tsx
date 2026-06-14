import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { HardDrive } from 'lucide-react';
import type { SystemStats } from 'pulsemachine';

interface MemoryChartProps {
  currentStats: SystemStats;
}

const MemoryChart: React.FC<MemoryChartProps> = ({ currentStats }) => {
  const { usagePercent, totalBytes, usedBytes } = currentStats.memory;

  const data = {
    labels: ['Used', 'Free'],
    datasets: [
      {
        data: [usagePercent, 100 - usagePercent],
        backgroundColor: [
          'var(--accent-purple)',
          'var(--bg-tertiary)',
        ],
        borderWidth: 0,
        cutout: '80%',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
    animation: {
      animateRotate: false,
      animateScale: false,
    },
  };

  return (
    <>
      <div className="widget-header">
        <HardDrive className="widget-icon" style={{ color: 'var(--accent-purple)' }} />
        Memory
      </div>
      <div className="memory-chart-container">
        <Doughnut data={data} options={options} />
        <div className="memory-center-text">
          <div className="memory-percent">{usagePercent.toFixed(1)}%</div>
          <div className="memory-label">
            {(usedBytes / 1024 / 1024 / 1024).toFixed(1)} / {(totalBytes / 1024 / 1024 / 1024).toFixed(1)} GB
          </div>
        </div>
      </div>
    </>
  );
};

export default MemoryChart;
