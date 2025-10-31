import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/testUtils';
import userEvent from '@testing-library/user-event';
import { VideoCard } from '../VideoCard';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('VideoCard', () => {
  const mockVideo = {
    videoId: 'test-video-123',
    title: 'Test Video Title',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    publishedAt: '2025-01-01T00:00:00Z',
    stats: {
      viewCount: 1500,
      commentCount: 45,
    },
    sentimentScore: 0.65,
  };

  it('should render video title', () => {
    renderWithProviders(<VideoCard video={mockVideo} />);
    expect(screen.getByText('Test Video Title')).toBeInTheDocument();
  });

  it('should render video thumbnail', () => {
    renderWithProviders(<VideoCard video={mockVideo} />);
    const img = screen.getByAltText('Test Video Title');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/thumb.jpg');
  });

  it('should display sentiment score badge', () => {
    renderWithProviders(<VideoCard video={mockVideo} />);
    expect(screen.getByText(/Score: 0.65/)).toBeInTheDocument();
  });

  it('should display view and comment counts', () => {
    renderWithProviders(<VideoCard video={mockVideo} />);
    expect(screen.getByText('1.5K')).toBeInTheDocument(); // views
    expect(screen.getByText('45')).toBeInTheDocument(); // comments
  });

  it('should show "Not analyzed" badge when no sentiment score', () => {
    const videoWithoutScore = { ...mockVideo, sentimentScore: undefined };
    renderWithProviders(<VideoCard video={videoWithoutScore} />);
    expect(screen.getByText('Not analyzed')).toBeInTheDocument();
  });

  it('should navigate to analyze page on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VideoCard video={mockVideo} />);

    const title = screen.getByText('Test Video Title');
    await user.click(title);

    expect(mockNavigate).toHaveBeenCalledWith('/analyze/test-video-123');
  });

  it('should call onAnalyze callback if provided', async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();
    renderWithProviders(<VideoCard video={mockVideo} onAnalyze={onAnalyze} />);

    const title = screen.getByText('Test Video Title');
    await user.click(title);

    expect(onAnalyze).toHaveBeenCalledWith('test-video-123');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should show analyzing state', () => {
    renderWithProviders(<VideoCard video={mockVideo} isAnalyzing={true} />);
    const analyzeButton = screen.getByRole('button', { name: /analyzing/i });
    expect(analyzeButton).toBeDisabled();
  });

  it('should format large view counts correctly', () => {
    const videoWithManyViews = {
      ...mockVideo,
      stats: { viewCount: 1_500_000, commentCount: 1000 },
    };
    renderWithProviders(<VideoCard video={videoWithManyViews} />);
    expect(screen.getByText('1.5M')).toBeInTheDocument();
    expect(screen.getByText('1.0K')).toBeInTheDocument();
  });

  it('should show correct sentiment badge color for positive score', () => {
    const positiveVideo = { ...mockVideo, sentimentScore: 0.75 };
    const { container } = renderWithProviders(<VideoCard video={positiveVideo} />);
    const badge = container.querySelector('[data-variant="success"]');
    expect(badge).toBeInTheDocument();
  });

  it('should show correct sentiment badge color for neutral score', () => {
    const neutralVideo = { ...mockVideo, sentimentScore: 0.5 };
    const { container } = renderWithProviders(<VideoCard video={neutralVideo} />);
    const badge = container.querySelector('[data-variant="warning"]');
    expect(badge).toBeInTheDocument();
  });

  it('should show correct sentiment badge color for negative score', () => {
    const negativeVideo = { ...mockVideo, sentimentScore: 0.2 };
    const { container } = renderWithProviders(<VideoCard video={negativeVideo} />);
    const badge = container.querySelector('[data-variant="error"]');
    expect(badge).toBeInTheDocument();
  });

  it('should format relative dates correctly', () => {
    const today = new Date().toISOString();
    const videoToday = { ...mockVideo, publishedAt: today };
    renderWithProviders(<VideoCard video={videoToday} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('should handle missing thumbnail gracefully', () => {
    const videoWithoutThumb = { ...mockVideo, thumbnailUrl: undefined };
    renderWithProviders(<VideoCard video={videoWithoutThumb} />);
    expect(screen.getByText('No thumbnail')).toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    renderWithProviders(<VideoCard video={mockVideo} />);
    const analyzeButton = screen.getByRole('button', { name: /analyze/i });
    expect(analyzeButton).toBeInTheDocument();
  });
});
