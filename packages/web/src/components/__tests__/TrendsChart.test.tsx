import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/testUtils';
import { TrendsChart } from '../TrendsChart';

const mockTrendData = [
  { date: '2025-10-07T00:00:00Z', avgScore: 0.4 },
  { date: '2025-10-10T00:00:00Z', avgScore: 0.46 },
  { date: '2025-10-13T00:00:00Z', avgScore: 0.52 },
];

describe('TrendsChart', () => {
  it('should render chart title', () => {
    render(<TrendsChart data={mockTrendData} />);

    expect(screen.getByText('Sentiment Trend')).toBeInTheDocument();
  });

  it('should render SVG chart with data', () => {
    const { container } = render(<TrendsChart data={mockTrendData} />);

    // Check that SVG element exists
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();

    // Check that a path (line) exists
    const path = container.querySelector('path.recharts-line-curve');
    expect(path).toBeInTheDocument();
  });

  it('should show empty state when no data', () => {
    render(<TrendsChart data={[]} />);

    expect(
      screen.getByText('No trend data available yet')
    ).toBeInTheDocument();
  });

  it('should render axis ticks', () => {
    const { container } = render(<TrendsChart data={mockTrendData} />);

    // Check for X and Y axis elements
    const xAxis = container.querySelector('.recharts-xAxis');
    const yAxis = container.querySelector('.recharts-yAxis');

    expect(xAxis).toBeInTheDocument();
    expect(yAxis).toBeInTheDocument();
  });
});
