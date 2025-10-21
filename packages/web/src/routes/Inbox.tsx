import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Crown, Inbox as InboxIcon, Loader2, MessageSquare, ThumbsUp, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useSession } from '@/hooks/useSession';

type FilterOption = 'all' | 'high-priority' | 'negative' | 'unanswered';

interface Comment {
  id: string;
  text: string;
  authorDisplayName: string;
  likeCount: number;
  publishedAt: string;
  videoId: string;
  videoTitle: string;
  priorityScore: number;
  reasons: string[];
  shouldAutoReply: boolean;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export default function Inbox() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [filter, setFilter] = useState<FilterOption>('high-priority');
  const [selectedComments, setSelectedComments] = useState<Set<string>>(new Set());

  const isPro = session?.tier === 'pro';

  // Fetch inbox comments
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['inbox', filter],
    queryFn: async () => {
      const response = await api.GET('/api/comments/inbox', {
        params: { query: { filter } }
      });
      return response.data;
    },
    enabled: isPro
  });

  const comments: Comment[] = data?.comments || [];

  // Toggle comment selection
  const toggleComment = (id: string) => {
    const newSelected = new Set(selectedComments);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedComments(newSelected);
  };

  // Select all/none
  const toggleAll = () => {
    if (selectedComments.size === comments.length) {
      setSelectedComments(new Set());
    } else {
      setSelectedComments(new Set(comments.map(c => c.id)));
    }
  };

  // Generate bulk replies
  const generateBulk = useMutation({
    mutationFn: async () => {
      const commentIds = Array.from(selectedComments);
      const response = await api.POST('/api/comments/generate-bulk', {
        body: { commentIds }
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Replies generated!', {
        description: `Generated ${selectedComments.size} replies`
      });
      setSelectedComments(new Set());
      refetch();
    },
    onError: (error: any) => {
      toast.error('Failed to generate replies', {
        description: error.message || 'Unknown error'
      });
    }
  });

  if (!isPro) {
    return (
      <div className="px-6 py-8">
        <div className="rounded-xl border border-brand-border bg-brand-surface p-12 shadow-card text-center">
          <Crown className="h-16 w-16 mx-auto mb-4 text-yellow-500" />
          <h2 className="text-2xl font-bold mb-2">Comments Inbox is a Pro Feature</h2>
          <p className="text-brand-text-secondary mb-6 max-w-lg mx-auto">
            Upgrade to Pro to access your unified comments inbox with AI-powered prioritization and bulk reply generation.
          </p>
          <Button onClick={() => navigate('/billing')} size="lg">
            <Crown className="mr-2 h-5 w-5" />
            Upgrade to Pro
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-1 text-brand-text-primary">Comments Inbox</h1>
        <p className="text-brand-text-secondary">
          AI-prioritized comments across all your videos
        </p>
      </div>

      {/* Filters and Actions */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={filter} onValueChange={(value: FilterOption) => setFilter(value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Comments</SelectItem>
              <SelectItem value="high-priority">High Priority</SelectItem>
              <SelectItem value="negative">Negative Sentiment</SelectItem>
              <SelectItem value="unanswered">Unanswered</SelectItem>
            </SelectContent>
          </Select>

          {comments.length > 0 && (
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {selectedComments.size === comments.length ? 'Deselect All' : 'Select All'}
            </Button>
          )}
        </div>

        {selectedComments.size > 0 && (
          <Button
            onClick={() => generateBulk.mutate()}
            disabled={generateBulk.isPending}
          >
            {generateBulk.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <MessageSquare className="mr-2 h-4 w-4" />
                Generate {selectedComments.size} {selectedComments.size === 1 ? 'Reply' : 'Replies'}
              </>
            )}
          </Button>
        )}
      </div>

      {/* Comments List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-text-secondary" />
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-xl border border-brand-border bg-brand-surface p-12 shadow-card text-center">
          <InboxIcon className="h-12 w-12 mx-auto mb-4 text-brand-text-secondary" />
          <h3 className="text-lg font-semibold mb-2">No comments found</h3>
          <p className="text-brand-text-secondary">
            {filter === 'high-priority'
              ? 'No high-priority comments at the moment'
              : 'Try analyzing some videos first to see comments here'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className={`rounded-xl border bg-brand-surface p-4 shadow-card transition cursor-pointer ${
                selectedComments.has(comment.id)
                  ? 'border-primary bg-primary/5'
                  : 'border-brand-border hover:border-primary/50'
              }`}
              onClick={() => toggleComment(comment.id)}
            >
              <div className="flex items-start gap-4">
                <input
                  type="checkbox"
                  checked={selectedComments.has(comment.id)}
                  onChange={() => toggleComment(comment.id)}
                  className="mt-1"
                  onClick={(e) => e.stopPropagation()}
                />

                <div className="flex-1 min-w-0">
                  {/* Video context */}
                  <div className="text-sm text-brand-text-secondary mb-2">
                    {comment.videoTitle}
                  </div>

                  {/* Comment text */}
                  <p className="text-brand-text-primary mb-3">{comment.text}</p>

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-sm text-brand-text-secondary">
                    <span>{comment.authorDisplayName}</span>
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" />
                      {comment.likeCount}
                    </span>
                    <span>{new Date(comment.publishedAt).toLocaleDateString()}</span>
                  </div>

                  {/* Priority info */}
                  {comment.priorityScore && (
                    <div className="mt-3 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div className="text-sm">
                        <span className="font-medium text-yellow-600">
                          Priority Score: {comment.priorityScore}
                        </span>
                        {comment.reasons && comment.reasons.length > 0 && (
                          <div className="text-brand-text-secondary mt-1">
                            {comment.reasons.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sentiment badge */}
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  comment.sentiment === 'positive'
                    ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300'
                    : comment.sentiment === 'negative'
                    ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}>
                  {comment.sentiment}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
