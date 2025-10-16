import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/testUtils';
import Dashboard from '../Dashboard';

// Mock the useSession hook
vi.mock('@/hooks/useSession', () => ({
  useSession: () => ({
    session: {
      user: {
        email: 'test@example.com',
      },
      tier: 'free',
      comments_analyzed_count: 0,
      replies_generated_count: 0,
    },
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

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

// Mock useNavigate and useSearchParams
const mockNavigate = vi.fn();
const mockSetSearchParams = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
  };
});

describe('Dashboard - YouTube Not Connected', () => {
  it('should show "Connect Your YouTube Channel" CTA when not connected', async () => {
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Connect Your YouTube Channel')).toBeInTheDocument();
    });
  });

  it('should display explanatory text about connecting YouTube', async () => {
    renderWithProviders(<Dashboard />);

    expect(
      await screen.findByText(/To view your uploads and analyze comments/i)
    ).toBeInTheDocument();
  });

  it('should show ConnectYouTubeButton when not connected', async () => {
    renderWithProviders(<Dashboard />);

    // The button text is "Connect with YouTube" from ConnectYouTubeButton component
    expect(await screen.findByRole('button', { name: /connect/i })).toBeInTheDocument();
  });

  it('should not show video cards when not connected', async () => {
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.queryByTestId('video-card')).not.toBeInTheDocument();
    });
  });

  it('should still show usage meters and account status when not connected', async () => {
    renderWithProviders(<Dashboard />);

    expect(await screen.findByText('Account Tier:')).toBeInTheDocument();
    expect(await screen.findByText('FREE')).toBeInTheDocument();
    expect(await screen.findByText('Usage This Period')).toBeInTheDocument();
  });
});
