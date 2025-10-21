import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tantml:invoke name="react-query';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { MessageSquare, Loader2, AlertCircle } from 'lucide-react';

interface ScoredComment {
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
  aiReply?: string;
}

export default function CommentsInboxPage() {
  const [filter, setFilter] = useState<'all' | 'high-priority' | 'unanswered' | 'negative'>('high-priority');
  const [selectedComments, setSelectedComments] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Fetch all comments across all videos with scores
  const { data, isLoading, error } = useQuery({
    queryKey: ['comments-inbox', filter],
    queryFn: async () => {
      const response = await api.get('/comments/inbox', {
        params: { filter }
      });
      return response.data.comments as ScoredComment[];
    }
  });

  // Generate replies for selected comments
  const generateBulkReplies = useMutation({
    mutationFn: async (commentIds: string[]) => {
      return await api.post('/comments/generate-bulk', { commentIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments-inbox'] });
      setSelectedComments(new Set());
    }
  });

  const handleSelectAll = () => {
    if (selectedComments.size === data?.length) {
      setSelectedComments(new Set());
    } else {
      setSelectedComments(new Set(data?.map(c => c.id) || []));
    }
  };

  const getPriorityColor = (score: number) => {
    if (score >= 60) return 'destructive';
    if (score >= 40) return 'warning';
    if (score >= 20) return 'default';
    return 'secondary';
  };

  const getSentimentEmoji = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return '😊';
      case 'negative': return '😠';
      default: return '😐';
    }
  };

  const highPriorityCount = data?.filter(c => c.priorityScore >= 40).length || 0;
  const negativeCount = data?.filter(c => c.sentiment === 'negative').length || 0;

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="h-8 w-8" />
            Comments Inbox
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage and reply to your YouTube comments in one place
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          <Button
            variant={filter === 'high-priority' ? 'default' : 'outline'}
            onClick={() => setFilter('high-priority')}
            size="sm"
          >
            🎯 High Priority
            {highPriorityCount > 0 && (
              <Badge variant="secondary" className="ml-2">{highPriorityCount}</Badge>
            )}
          </Button>
          <Button
            variant={filter === 'unanswered' ? 'default' : 'outline'}
            onClick={() => setFilter('unanswered')}
            size="sm"
          >
            💬 Unanswered
          </Button>
          <Button
            variant={filter === 'negative' ? 'default' : 'outline'}
            onClick={() => setFilter('negative')}
            size="sm"
          >
            😠 Negative
            {negativeCount > 0 && (
              <Badge variant="secondary" className="ml-2">{negativeCount}</Badge>
            )}
          </Button>
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
            size="sm"
          >
            ⚪ All
          </Button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedComments.size > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center">
            <span className="font-medium">
              {selectedComments.size} comment{selectedComments.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button
                onClick={() => generateBulkReplies.mutate(Array.from(selectedComments))}
                disabled={generateBulkReplies.isPending}
              >
                {generateBulkReplies.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                🤖 Generate Replies for Selected
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedComments(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading comments...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <p className="font-medium text-destructive">Failed to load comments</p>
            <p className="text-sm text-muted-foreground mt-1">
              {error instanceof Error ? error.message : 'An error occurred'}
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && data?.length === 0 && (
        <div className="text-center py-12">
          <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No comments found</h3>
          <p className="text-muted-foreground">
            {filter === 'high-priority' && 'No high-priority comments at the moment'}
            {filter === 'negative' && 'No negative comments found'}
            {filter === 'unanswered' && 'All comments have been answered!'}
            {filter === 'all' && 'Connect your YouTube account to see comments'}
          </p>
        </div>
      )}

      {/* Comments List */}
      {!isLoading && !error && data && data.length > 0 && (
        <div className="space-y-3">
          {/* Select All */}
          <div className="flex items-center gap-3 pb-2 border-b">
            <Checkbox
              checked={selectedComments.size === data?.length && data.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm text-muted-foreground">
              Select all ({data.length} comments)
            </span>
          </div>

          {data.map(comment => (
            <CommentRow
              key={comment.id}
              comment={comment}
              isSelected={selectedComments.has(comment.id)}
              onSelect={(selected) => {
                const newSelected = new Set(selectedComments);
                if (selected) {
                  newSelected.add(comment.id);
                } else {
                  newSelected.delete(comment.id);
                }
                setSelectedComments(newSelected);
              }}
              priorityColor={getPriorityColor(comment.priorityScore)}
              sentimentEmoji={getSentimentEmoji(comment.sentiment)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Individual comment row component
function CommentRow({
  comment,
  isSelected,
  onSelect,
  priorityColor,
  sentimentEmoji
}: {
  comment: ScoredComment;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  priorityColor: string;
  sentimentEmoji: string;
}) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [editedReply, setEditedReply] = useState(comment.aiReply || '');
  const queryClient = useQueryClient();

  const generateReply = useMutation({
    mutationFn: async () => {
      return await api.post(`/comments/${comment.id}/generate-reply`);
    },
    onSuccess: (data) => {
      setEditedReply(data.data.reply);
      setShowReplyInput(true);
    }
  });

  const postReply = useMutation({
    mutationFn: async (replyText: string) => {
      return await api.post(`/comments/${comment.id}/post-reply`, {
        text: replyText
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments-inbox'] });
      setShowReplyInput(false);
    }
  });

  return (
    <div className={`border rounded-lg p-4 transition-colors ${isSelected ? 'bg-primary/5 border-primary/30' : 'bg-card'}`}>
      <div className="flex gap-3">
        {/* Checkbox */}
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
        />

        {/* Priority Badge */}
        <div className="flex-shrink-0">
          {comment.priorityScore > 0 ? (
            <Badge variant={priorityColor as any} className="font-medium">
              {comment.priorityScore}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Low
            </Badge>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">
                  {sentimentEmoji} {comment.authorDisplayName}
                </span>
                {comment.likeCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    👍 {comment.likeCount}
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                on "<span className="font-medium">{comment.videoTitle}</span>" • {formatTimeAgo(comment.publishedAt)}
              </div>
            </div>
          </div>

          <p className="text-sm text-foreground mb-3 whitespace-pre-wrap">{comment.text}</p>

          {/* Priority Reasons */}
          {comment.reasons.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {comment.reasons.map((reason, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  ⚡ {reason}
                </Badge>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {!showReplyInput && !comment.aiReply && (
              <Button
                size="sm"
                onClick={() => generateReply.mutate()}
                disabled={generateReply.isPending}
                className="w-fit"
              >
                {generateReply.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                🤖 Generate Reply
              </Button>
            )}

            {(showReplyInput || comment.aiReply) && (
              <div className="w-full">
                <div className="bg-muted/50 border rounded-lg p-3 mb-2">
                  <textarea
                    value={editedReply}
                    onChange={(e) => setEditedReply(e.target.value)}
                    className="w-full bg-transparent text-sm resize-none focus:outline-none min-h-[60px]"
                    placeholder="AI-generated reply will appear here..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => postReply.mutate(editedReply)}
                    disabled={postReply.isPending || !editedReply.trim()}
                  >
                    {postReply.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                    📤 Post to YouTube
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generateReply.mutate()}
                    disabled={generateReply.isPending}
                  >
                    {generateReply.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : '🔄'}
                    Regenerate
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowReplyInput(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(date: string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d ago`;
  return `${Math.floor(diffMins / 10080)}w ago`;
}
