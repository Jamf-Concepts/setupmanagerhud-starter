import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { applyChartColors, getChartColors } from '@jamf/design-system-web-components-next/chart';
import type { EventRow } from '../api.js';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Title, Tooltip, Legend, Filler,
);

interface Props {
  events: EventRow[];
}

function volumeOverTime(events: EventRow[]) {
  const counts: Record<string, number> = {};
  for (const e of events) {
    const day = e.timestamp.slice(0, 10);
    counts[day] = (counts[day] ?? 0) + 1;
  }
  const labels = Object.keys(counts).sort();
  return { labels, datasets: applyChartColors([{ label: 'Enrollments', data: labels.map(l => counts[l] ?? 0) }]) };
}

function failureRateOverTime(events: EventRow[]) {
  const total: Record<string, number> = {};
  const failed: Record<string, number> = {};
  for (const e of events) {
    const day = e.timestamp.slice(0, 10);
    total[day] = (total[day] ?? 0) + 1;
    if (e.hasFailedActions) failed[day] = (failed[day] ?? 0) + 1;
  }
  const labels = Object.keys(total).sort();
  const colors = getChartColors();
  return {
    labels,
    datasets: [{
      label: 'Failure Rate %',
      data: labels.map(l => total[l] ? ((failed[l] ?? 0) / total[l]) * 100 : 0),
      borderColor: colors?.red.active,
      backgroundColor: `${colors?.red.active ?? ''}33`,
      fill: true,
      tension: 0.4,
    }],
  };
}

function modelBreakdown(events: EventRow[]) {
  const counts: Record<string, number> = {};
  for (const e of events) {
    const key = e.modelName ?? 'Unknown';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const labels = Object.keys(counts);
  const colors = getChartColors();
  const palette = colors
    ? [colors.blue.active, colors.green.active, colors.yellow.active, colors.red.active, colors.blue.disabled]
    : [];
  return {
    labels,
    datasets: [{
      data: labels.map(l => counts[l] ?? 0),
      backgroundColor: labels.map((_, i) => palette[i % palette.length] ?? '#888'),
    }],
  };
}

function osBreakdown(events: EventRow[]) {
  const counts: Record<string, number> = {};
  for (const e of events) {
    const key = e.macosVersion ?? 'Unknown';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const labels = Object.keys(counts);
  const colors = getChartColors();
  const palette = colors
    ? [colors.blue.active, colors.green.active, colors.yellow.active, colors.red.active]
    : [];
  return {
    labels,
    datasets: [{
      data: labels.map(l => counts[l] ?? 0),
      backgroundColor: labels.map((_, i) => palette[i % palette.length] ?? '#888'),
    }],
  };
}

const baseOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: { legend: { position: 'bottom' as const } },
} as const;

export default function Charts({ events }: Props) {
  if (events.length === 0) {
    return <p style={{ color: 'var(--color-text-secondary)' }}>No event data to chart.</p>;
  }
  const colors = getChartColors();
  const axisColors = {
    scales: {
      x: { grid: { color: colors?.border }, ticks: { color: colors?.text } },
      y: { grid: { color: colors?.border }, ticks: { color: colors?.text } },
    },
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--spacing-4)' }}>
      <div>
        <h3 style={{ marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Volume Over Time</h3>
        <Bar data={volumeOverTime(events)} options={{ ...baseOptions, ...axisColors }} />
      </div>
      <div>
        <h3 style={{ marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Failure Rate</h3>
        <Line data={failureRateOverTime(events)} options={{ ...baseOptions, ...axisColors }} />
      </div>
      <div>
        <h3 style={{ marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Model Breakdown</h3>
        <Doughnut data={modelBreakdown(events)} options={baseOptions} />
      </div>
      <div>
        <h3 style={{ marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>macOS Version</h3>
        <Doughnut data={osBreakdown(events)} options={baseOptions} />
      </div>
    </div>
  );
}
