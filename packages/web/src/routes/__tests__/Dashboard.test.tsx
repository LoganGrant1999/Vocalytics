import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/testUtils';
import { userEvent } from '@testing-library/user-event';
import Dashboard from '../Dashboard';

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

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

describe('Dashboard', () => {
  it('should render "Your Recent Uploads" section', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Your Recent Uploads')).toBeInTheDocument();
    });
  });

  it('should display 3 video cards with titles', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('How I Edit')).toBeInTheDocument();
      expect(screen.getByText('My Gear Setup')).toBeInTheDocument();
      expect(screen.getByText('Studio Tour')).toBeInTheDocument();
    });
  });

  it('should show sentiment badge on analyzed video', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      // vid-a has score 0.48 in fixtures
      expect(screen.getByText('Score: 0.48')).toBeInTheDocument();
    });
  });

  it('should show "Not analyzed" badge on unanalyzed videos', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      // vid-b and vid-c don't have analyses
      const notAnalyzedBadges = screen.getAllByText('Not analyzed');
      expect(notAnalyzedBadges.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('should trigger analysis when Analyze button is clicked', async () => {
    const user = userEvent.setup();
    render(<Dashboard />);

    // Wait for videos to load
    await waitFor(() => {
      expect(screen.getByText('My Gear Setup')).toBeInTheDocument();
    });

    // Find all Analyze buttons
    const analyzeButtons = screen.getAllByRole('button', {
      name: /analyze/i,
    });

    // Click the first Analyze button
    await user.click(analyzeButtons[0]);

    // Should show "Analyzing..." toast or button state
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  it('should display trends chart when trend data exists', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Sentiment Trend')).toBeInTheDocument();
    });
  });
});
