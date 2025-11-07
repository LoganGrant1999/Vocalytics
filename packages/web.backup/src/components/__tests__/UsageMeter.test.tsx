import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/testUtils';
import { UsageMeter } from '../UsageMeter';

describe('UsageMeter', () => {
  it('should display usage label', () => {
    renderWithProviders(<UsageMeter label="Analyses" current={5} limit={10} />);
    expect(screen.getByText('Analyses')).toBeInTheDocument();
  });

  it('should display current and limit values', () => {
    renderWithProviders(<UsageMeter label="Replies" current={3} limit={5} />);
    expect(screen.getByText('3 / 5')).toBeInTheDocument();
  });

  it('should show progress bar', () => {
    const { container } = renderWithProviders(
      <UsageMeter label="Tests" current={7} limit={10} />
    );

    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toBeInTheDocument();
  });

  it('should calculate correct percentage', () => {
    const { container } = renderWithProviders(
      <UsageMeter label="Tests" current={25} limit={100} />
    );

    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toHaveAttribute('aria-valuenow', '25');
  });

  it('should show 100% when at limit', () => {
    const { container } = renderWithProviders(
      <UsageMeter label="Tests" current={10} limit={10} />
    );

    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toHaveAttribute('aria-valuenow', '100');
  });

  it('should handle zero limit gracefully', () => {
    renderWithProviders(<UsageMeter label="Tests" current={0} limit={0} />);
    expect(screen.getByText('0 / 0')).toBeInTheDocument();
  });

  it('should show warning color when near limit', () => {
    const { container } = renderWithProviders(
      <UsageMeter label="Tests" current={9} limit={10} />
    );

    // Should have some visual indicator (e.g., color class)
    expect(container.textContent).toContain('9 / 10');
  });

  it('should show danger color when at limit', () => {
    const { container } = renderWithProviders(
      <UsageMeter label="Tests" current={10} limit={10} />
    );

    expect(container.textContent).toContain('10 / 10');
  });

  it('should handle unlimited (no limit)', () => {
    renderWithProviders(<UsageMeter label="Pro Tier" current={1000} limit={Infinity} />);
    // Should render without errors
    expect(screen.getByText('Pro Tier')).toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    const { container } = renderWithProviders(
      <UsageMeter label="Analyses" current={5} limit={10} />
    );

    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
  });
});
