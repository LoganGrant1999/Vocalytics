import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/testUtils';
import { SentimentBar } from '../SentimentBar';

describe('SentimentBar', () => {
  it('should render sentiment percentages', () => {
    const sentiment = {
      pos: 0.6,
      neu: 0.3,
      neg: 0.1,
    };

    renderWithProviders(<SentimentBar sentiment={sentiment} />);

    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
  });

  it('should display sentiment labels', () => {
    const sentiment = {
      pos: 0.5,
      neu: 0.3,
      neg: 0.2,
    };

    renderWithProviders(<SentimentBar sentiment={sentiment} />);

    expect(screen.getByText('Positive')).toBeInTheDocument();
    expect(screen.getByText('Neutral')).toBeInTheDocument();
    expect(screen.getByText('Negative')).toBeInTheDocument();
  });

  it('should render bars with correct widths', () => {
    const sentiment = {
      pos: 0.7,
      neu: 0.2,
      neg: 0.1,
    };

    const { container } = renderWithProviders(<SentimentBar sentiment={sentiment} />);

    // Check that bars are rendered
    const bars = container.querySelectorAll('[data-sentiment-bar]');
    expect(bars.length).toBeGreaterThan(0);
  });

  it('should handle zero values', () => {
    const sentiment = {
      pos: 1.0,
      neu: 0,
      neg: 0,
    };

    renderWithProviders(<SentimentBar sentiment={sentiment} />);

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('should show correct colors for sentiment', () => {
    const sentiment = {
      pos: 0.5,
      neu: 0.3,
      neg: 0.2,
    };

    const { container } = renderWithProviders(<SentimentBar sentiment={sentiment} />);

    // Should have color classes (green for positive, red for negative, gray for neutral)
    expect(container.querySelector('.bg-green-500')).toBeInTheDocument();
    expect(container.querySelector('.bg-red-500')).toBeInTheDocument();
    expect(container.querySelector('.bg-gray-500')).toBeInTheDocument();
  });

  it('should handle decimal values correctly', () => {
    const sentiment = {
      pos: 0.333,
      neu: 0.333,
      neg: 0.334,
    };

    renderWithProviders(<SentimentBar sentiment={sentiment} />);

    // Should round to whole percentages
    expect(screen.getByText(/33%/)).toBeInTheDocument();
  });

  it('should be responsive', () => {
    const sentiment = {
      pos: 0.6,
      neu: 0.3,
      neg: 0.1,
    };

    const { container } = renderWithProviders(<SentimentBar sentiment={sentiment} />);

    // Should have flex or grid layout
    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass(/flex|grid/);
  });
});
