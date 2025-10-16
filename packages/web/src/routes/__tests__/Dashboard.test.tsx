import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/testUtils';
import userEvent from '@testing-library/user-event';
import Dashboard from '../Dashboard';

import { fixtures } from '@/test/fixtures';

// Mock the useSession hook
vi.mock('@/hooks/useSession', () => ({
  useSession: () => ({
    session: {
      user: {
        email: 'test@example.com',
      },
      tier: 'free',
      comments_analyzed_count: 1,
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

// Mock useChannelData to return fixture data directly
vi.mock('@/hooks/useChannelData', () => ({
  useChannelData: () => {
    const analysisMap = new Map(
      fixtures.analysesList.map((a) => [a.videoId, a.score])
    );

    const videos = fixtures.videos.map((v) => ({
      ...v,
      sentimentScore: analysisMap.get(v.videoId),
    }));

    return {
      videos,
      analyses: fixtures.analysesList,
      trends: fixtures.trends,
      isLoading: false,
      analyze: vi.fn(),
      isAnalyzing: false,
    };
  },
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

describe('Dashboard', () => {
  it('should render "Your Recent Uploads" section', async () => {
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Your Recent Uploads')).toBeInTheDocument();
    });
  });

  it('should display 3 video cards with titles', async () => {
    renderWithProviders(<Dashboard />);

    // Use findByText for async data
    expect(await screen.findByText('How I Edit')).toBeInTheDocument();
    expect(await screen.findByText('My Gear Setup')).toBeInTheDocument();
    expect(await screen.findByText('Studio Tour')).toBeInTheDocument();
  });

  it('should show sentiment badge on analyzed video', async () => {
    renderWithProviders(<Dashboard />);

    // vid-a has score 0.48 in fixtures
    expect(await screen.findByText('Score: 0.48')).toBeInTheDocument();
  });

  it('should show "Not analyzed" badge on unanalyzed videos', async () => {
    renderWithProviders(<Dashboard />);

    // Wait for data to load first
    await screen.findByText('How I Edit');

    // vid-b and vid-c don't have analyses
    const notAnalyzedBadges = screen.getAllByText('Not analyzed');
    expect(notAnalyzedBadges.length).toBeGreaterThanOrEqual(2);
  });

  it('should trigger analysis when Analyze button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);

    // Wait for videos to load
    await screen.findByText('My Gear Setup');

    // Find all Analyze buttons
    const analyzeButtons = screen.getAllByRole('button', {
      name: /analyze/i,
    });

    // Click the first Analyze button
    await user.click(analyzeButtons[0]);

    // Should navigate to analyze page
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  it('should display trends chart when trend data exists', async () => {
    renderWithProviders(<Dashboard />);

    // Wait for async data
    expect(await screen.findByText('Sentiment Trend')).toBeInTheDocument();
  });
});
