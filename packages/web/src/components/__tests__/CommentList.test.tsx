import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/testUtils';
import userEvent from '@testing-library/user-event';
import { CommentList } from '../CommentList';

describe('CommentList', () => {
  const mockComments = [
    {
      id: 'comment-1',
      videoId: 'video-123',
      author: 'John Doe',
      text: 'Great video! Very helpful.',
      likeCount: 15,
      publishedAt: '2025-01-01T00:00:00Z',
      replyCount: 2,
      isReply: false,
      sentiment: {
        positive: 0.8,
        neutral: 0.15,
        negative: 0.05,
        label: 'positive' as const,
      },
    },
    {
      id: 'comment-2',
      videoId: 'video-123',
      author: 'Jane Smith',
      text: 'I disagree with this approach.',
      likeCount: 3,
      publishedAt: '2025-01-02T00:00:00Z',
      replyCount: 0,
      isReply: false,
      sentiment: {
        positive: 0.1,
        neutral: 0.2,
        negative: 0.7,
        label: 'negative' as const,
      },
    },
    {
      id: 'comment-3',
      videoId: 'video-123',
      author: 'Bob Johnson',
      text: 'Interesting points made here.',
      likeCount: 8,
      publishedAt: '2025-01-03T00:00:00Z',
      replyCount: 1,
      isReply: false,
      sentiment: {
        positive: 0.4,
        neutral: 0.5,
        negative: 0.1,
        label: 'neutral' as const,
      },
    },
  ];

  it('should render all comments', () => {
    renderWithProviders(<CommentList comments={mockComments} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
  });

  it('should display comment text', () => {
    renderWithProviders(<CommentList comments={mockComments} />);

    expect(screen.getByText('Great video! Very helpful.')).toBeInTheDocument();
    expect(screen.getByText('I disagree with this approach.')).toBeInTheDocument();
    expect(screen.getByText('Interesting points made here.')).toBeInTheDocument();
  });

  it('should show like counts', () => {
    renderWithProviders(<CommentList comments={mockComments} />);

    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('should show reply counts', () => {
    renderWithProviders(<CommentList comments={mockComments} />);

    expect(screen.getByText('2')).toBeInTheDocument(); // comment-1
    expect(screen.getByText('1')).toBeInTheDocument(); // comment-3
  });

  it('should display sentiment badges', () => {
    renderWithProviders(<CommentList comments={mockComments} />);

    expect(screen.getByText('positive')).toBeInTheDocument();
    expect(screen.getByText('negative')).toBeInTheDocument();
    expect(screen.getByText('neutral')).toBeInTheDocument();
  });

  it('should apply correct sentiment colors', () => {
    const { container } = renderWithProviders(<CommentList comments={mockComments} />);

    // Check for sentiment color classes
    expect(container.querySelector('.bg-green-100')).toBeInTheDocument(); // positive
    expect(container.querySelector('.bg-red-100')).toBeInTheDocument(); // negative
    expect(container.querySelector('.bg-gray-100')).toBeInTheDocument(); // neutral
  });

  it('should show empty state when no comments', () => {
    renderWithProviders(<CommentList comments={[]} />);

    expect(screen.getByText('No comments found for this video.')).toBeInTheDocument();
  });

  it('should highlight selected comment', () => {
    const { container } = renderWithProviders(
      <CommentList comments={mockComments} selectedCommentId="comment-2" />
    );

    const selectedComment = container.querySelector('.border-primary');
    expect(selectedComment).toBeInTheDocument();
  });

  it('should call onSelectComment when comment is clicked', async () => {
    const user = userEvent.setup();
    const onSelectComment = vi.fn();

    renderWithProviders(
      <CommentList comments={mockComments} onSelectComment={onSelectComment} />
    );

    const replyButton = screen.getAllByRole('button', { name: /generate reply/i })[0];
    await user.click(replyButton);

    expect(onSelectComment).toHaveBeenCalledWith(mockComments[0]);
  });

  it('should handle comments without sentiment', () => {
    const commentsWithoutSentiment = [
      {
        ...mockComments[0],
        sentiment: undefined,
      },
    ];

    renderWithProviders(<CommentList comments={commentsWithoutSentiment} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    // Should still render without throwing errors
  });

  it('should render all generate reply buttons', () => {
    renderWithProviders(<CommentList comments={mockComments} />);

    const replyButtons = screen.getAllByRole('button', { name: /generate reply/i });
    expect(replyButtons).toHaveLength(3);
  });

  it('should show icons for likes and replies', () => {
    renderWithProviders(<CommentList comments={mockComments} />);

    // Icons should be present (lucide-react icons)
    const { container } = renderWithProviders(<CommentList comments={mockComments} />);
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
  });

  it('should handle long comment text', () => {
    const longComment = {
      ...mockComments[0],
      text: 'This is a very long comment that should be displayed properly without breaking the layout. '.repeat(10),
    };

    renderWithProviders(<CommentList comments={[longComment]} />);

    expect(screen.getByText(/This is a very long comment/)).toBeInTheDocument();
  });

  it('should format published dates', () => {
    renderWithProviders(<CommentList comments={mockComments} />);

    // Dates should be visible somewhere in the component
    const { container } = renderWithProviders(<CommentList comments={mockComments} />);
    expect(container.textContent).toContain('2025-01-01');
  });
});
