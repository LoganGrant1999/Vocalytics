import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/testUtils';
import { TrendsChart } from '../TrendsChart';

const mockTrendData = [
  { date: '2025-10-07T00:00:00Z', avgScore: 0.4 },
  { date: '2025-10-10T00:00:00Z', avgScore: 0.46 },
  { date: '2025-10-13T00:00:00Z', avgScore: 0.52 },
];

describe('TrendsChart', () => {
  it('should render chart title', () => {
    renderWithProviders(<TrendsChart data={mockTrendData} />);

    expect(screen.getByText('Sentiment Trend')).toBeInTheDocument();
  });

  it('should render ResponsiveContainer when data exists', () => {
    const { container } = renderWithProviders(<TrendsChart data={mockTrendData} />);

    // Just verify the component renders without error
    // Recharts needs real dimensions to render SVG elements,
    // which we don't have in the test environment
    const chartContainer = container.querySelector('.recharts-responsive-container');
    expect(chartContainer).toBeInTheDocument();
  });

  it('should show empty state when no data', () => {
    renderWithProviders(<TrendsChart data={[]} />);

    expect(
      screen.getByText('No trend data available yet')
    ).toBeInTheDocument();
  });
});
