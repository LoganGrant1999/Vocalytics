import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import CommentRow from "./CommentRow";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

interface PriorityQueueCardProps {
  plan: "free" | "pro";
}

const PriorityQueueCard = ({ plan }: PriorityQueueCardProps) => {
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [isGeneratingReplies, setIsGeneratingReplies] = useState(false);

  // Fetch high-priority comments
  const { data, isLoading } = useQuery({
    queryKey: ['commentsInbox', 'high-priority'],
    queryFn: () => api.getCommentsInbox('high-priority'),
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 0, // Always fetch fresh data
    cacheTime: 0, // Don't cache
  });

  const comments = data?.comments || [];

  // Load cached replies and generate new ones for comments without replies
  useEffect(() => {
    if (comments.length > 0) {
      console.log('[DEBUG] Comments received:', comments);

      // First, load any cached replies from the API response
      const cachedReplies: Record<string, string> = {};
      const commentsNeedingReplies = [];

      for (const comment of comments) {
        console.log('[DEBUG] Comment ID:', comment.id, 'suggestedReply:', comment.suggestedReply);
        if (comment.suggestedReply) {
          cachedReplies[comment.id] = comment.suggestedReply;
        } else {
          commentsNeedingReplies.push(comment);
        }
      }

      console.log('[DEBUG] Cached replies:', cachedReplies);
      console.log('[DEBUG] Comments needing replies:', commentsNeedingReplies.length);

      // Set cached replies immediately
      setReplies(cachedReplies);

      // Generate replies for comments that don't have them yet
      if (commentsNeedingReplies.length > 0) {
        generateReplies(commentsNeedingReplies);
      }
    }
  }, [comments]);

  const generateReplies = async (commentsToGenerate: typeof comments) => {
    if (commentsToGenerate.length === 0) return;

    setIsGeneratingReplies(true);
    try {
      // Group comments by video ID for batch processing
      const videoGroups = commentsToGenerate.reduce((acc, comment) => {
        const videoId = comment.videoId;
        if (!acc[videoId]) {
          acc[videoId] = [];
        }
        acc[videoId].push(comment);
        return acc;
      }, {} as Record<string, typeof comments>);

      // Generate replies for each video
      const newReplies: Record<string, string> = {};
      for (const [videoId, videoComments] of Object.entries(videoGroups)) {
        const response = await api.generateReplies({
          videoId,
          commentIds: videoComments.map(c => c.id),
        });

        // Map replies by comment ID
        response.replies.forEach(reply => {
          newReplies[reply.commentId] = reply.suggestedReply;
        });
      }

      // Merge new replies with existing cached ones
      setReplies(prev => ({ ...prev, ...newReplies }));
    } catch (error) {
      console.error('Failed to generate replies:', error);
    } finally {
      setIsGeneratingReplies(false);
    }
  };

  const handleSendAll = () => {
    console.log("TODO: batch POST /api/youtube/reply");
  };

  // Helper to format timestamp
  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Helper to generate badges from reasons
  const generateBadges = (reasons: string[]) => {
    return reasons.map(reason => {
      // Map reasons to badges
      if (reason.includes('question')) return 'Question';
      if (reason.includes('sponsor') || reason.includes('brand')) return 'Sponsor mention';
      if (reason.includes('fan') || reason.includes('loyal')) return 'Top Fan';
      return reason.charAt(0).toUpperCase() + reason.slice(1); // Capitalize first letter
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">High-Priority Replies</h3>
          {!isLoading && comments.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {comments.length} ready
            </span>
          )}
        </div>

        <Button
          onClick={handleSendAll}
          disabled={plan === "free" || comments.length === 0}
          className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {plan === "free" ? "Send All (Pro only)" : "Send All Approved"}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        We pull the comments that matter most. You approve the replies. We send them for you.
      </p>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && comments.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No comments to respond to right now
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            High-priority comments will appear here when you analyze your videos
          </p>
        </div>
      )}

      {/* Generating replies state */}
      {!isLoading && comments.length > 0 && isGeneratingReplies && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
            <p className="text-sm text-muted-foreground">Generating AI replies in your voice...</p>
          </div>
        </div>
      )}

      {/* Comments list */}
      {!isLoading && comments.length > 0 && !isGeneratingReplies && (
        <>
          <div className="space-y-0">
            {comments.map((comment) => (
              <CommentRow
                key={comment.id}
                commenterHandle={comment.authorDisplayName}
                timestamp={formatTimestamp(comment.publishedAt)}
                likes={comment.likeCount}
                badges={generateBadges(comment.reasons)}
                originalText={comment.text}
                draftedReply={replies[comment.id] || ""}
              />
            ))}
          </div>

          {/* Footer note */}
          <p className="text-xs text-muted-foreground mt-6 text-center">
            Replies post from your channel. We space timing so it looks natural.
          </p>
        </>
      )}
    </div>
  );
};

export default PriorityQueueCard;
