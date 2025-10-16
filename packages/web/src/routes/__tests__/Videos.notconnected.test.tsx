import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/testUtils';
import Videos from '../Videos';

// Mock useAnalytics
vi.mock('@/hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    track: vi.fn(),
  }),
}));

// Mock useChannelData to simulate YouTube not connected (403 error)
vi.mock('@/hooks/useChannelData', () => ({
  useChannelData: () => ({
    videos: [],
    analyses: [],
    trends: [],
    isLoading: false,
    isYouTubeNotConnected: true,
    videosError: {
      response: {
        status: 403,
        data: {
          error: 'YOUTUBE_NOT_CONNECTED',
          message: 'YouTube account not connected. Please connect to list uploads.',
        },
      },
    },
    analyze: vi.fn(),
    isAnalyzing: false,
  }),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Videos - YouTube Not Connected', () => {
  it('should show "Connect Your YouTube Channel" CTA when not connected', async () => {
    renderWithProviders(<Videos />);

    await waitFor(() => {
      expect(screen.getByText('Connect Your YouTube Channel')).toBeInTheDocument();
    });
  });

  it('should display explanatory text about connecting YouTube', async () => {
    renderWithProviders(<Videos />);

    expect(
      await screen.findByText(/Connect your YouTube account to see your uploads/i)
    ).toBeInTheDocument();
  });

  it('should show ConnectYouTubeButton when not connected', async () => {
    renderWithProviders(<Videos />);

    // The button text is "Connect with YouTube" from ConnectYouTubeButton component
    expect(await screen.findByRole('button', { name: /connect/i })).toBeInTheDocument();
  });

  it('should still show manual input form when not connected', async () => {
    renderWithProviders(<Videos />);

    expect(await screen.findByText('Analyze Any Video')).toBeInTheDocument();
    expect(
      await screen.findByText(/Enter a YouTube video URL or ID/i)
    ).toBeInTheDocument();
  });

  it('should not show video cards when not connected', async () => {
    renderWithProviders(<Videos />);

    await waitFor(() => {
      expect(screen.queryByTestId('video-card')).not.toBeInTheDocument();
    });
  });

  it('should not show "Your Recent Uploads" section when not connected', async () => {
    renderWithProviders(<Videos />);

    await waitFor(() => {
      expect(screen.queryByText('Your Recent Uploads')).not.toBeInTheDocument();
    });
  });
});
