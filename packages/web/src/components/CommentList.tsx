import { Button } from '@/components/ui/button';
import { MessageSquare, ThumbsUp } from 'lucide-react';
import type { components } from '@/types/api';

type Comment = components['schemas']['Comment'];
type Sentiment = components['schemas']['Sentiment'];

interface CommentWithSentiment extends Comment {
  sentiment?: Sentiment;
}

interface CommentListProps {
  comments: CommentWithSentiment[];
  onSelectComment?: (comment: CommentWithSentiment) => void;
  selectedCommentId?: string;
}

/**
 * Displays a list of comments with sentiment badges and reply generation buttons.
 */
export function CommentList({
  comments,
  onSelectComment,
  selectedCommentId,
}: CommentListProps) {
  const getSentimentColor = (label?: string) => {
    switch (label) {
      case 'positive':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'negative':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'neutral':
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (comments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No comments found for this video.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <div
          key={comment.id}
          className={`rounded-lg border p-4 transition-colors ${
            selectedCommentId === comment.id
              ? 'border-primary bg-accent/50'
              : 'hover:bg-accent/30'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-sm">{comment.author}</span>
                {comment.sentiment?.label && (
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getSentimentColor(
                      comment.sentiment.label
                    )}`}
                  >
                    {comment.sentiment.label}
                  </span>
                )}
                {comment.publishedAt && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(comment.publishedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              <p className="text-sm mb-3 whitespace-pre-wrap">{comment.text}</p>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {comment.likeCount !== undefined && (
                  <div className="flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3" />
                    {comment.likeCount}
                  </div>
                )}
                {comment.replyCount !== undefined && comment.replyCount > 0 && (
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {comment.replyCount} replies
                  </div>
                )}
              </div>
            </div>

            {onSelectComment && (
              <Button
                size="sm"
                variant={selectedCommentId === comment.id ? 'default' : 'outline'}
                onClick={() => onSelectComment(comment)}
              >
                {selectedCommentId === comment.id ? 'Selected' : 'Generate Reply'}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
