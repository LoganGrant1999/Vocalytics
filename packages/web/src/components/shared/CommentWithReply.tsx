import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";
import api from "@/lib/api";

interface CommentWithReplyProps {
  commenterHandle: string;
  timestamp: string;
  likes: number;
  originalText: string;
  sentiment?: "positive" | "negative";
  canReply?: boolean;
  commentId?: string;
  videoId?: string;
  postedReply?: {
    replyText: string;
    postedAt: string;
  } | null;
}

const CommentWithReply = ({
  commenterHandle,
  timestamp,
  likes,
  originalText,
  sentiment,
  canReply = false,
  commentId,
  videoId,
  postedReply = null,
}: CommentWithReplyProps) => {
  const [reply, setReply] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isPosted, setIsPosted] = useState(!!postedReply);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleGenerateReply = async () => {
    if (!commentId || !videoId) {
      console.error("Cannot generate reply: missing commentId or videoId");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await api.generateReplies({
        videoId,
        commentIds: [commentId],
      });

      if (response.replies && response.replies.length > 0) {
        setReply(response.replies[0].suggestedReply);
      } else {
        setError("Failed to generate reply");
      }
    } catch (err) {
      console.error("Failed to generate reply:", err);
      setError(err instanceof Error ? err.message : "Failed to generate reply");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendReply = async () => {
    if (!commentId || !reply.trim() || !videoId) {
      console.error("Cannot post reply: missing commentId, videoId, or reply text");
      return;
    }

    setIsPosting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await api.postReply({
        parentId: commentId,
        text: reply,
        videoId: videoId,
      });

      setSuccessMessage("Reply posted successfully!");
      setIsPosted(true);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Failed to post reply:", err);
      setError(err instanceof Error ? err.message : "Failed to post reply");
    } finally {
      setIsPosting(false);
    }
  };

  const sentimentColor = sentiment === "positive" 
    ? "text-success" 
    : sentiment === "negative" 
    ? "text-destructive" 
    : "text-muted-foreground";

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
      {/* Comment header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{commenterHandle}</span>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">{timestamp}</span>
          {sentiment && (
            <>
              <span className="text-xs text-muted-foreground">•</span>
              <span className={`text-xs font-medium capitalize ${sentimentColor}`}>
                {sentiment}
              </span>
            </>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{likes} likes</span>
      </div>

      {/* Original comment */}
      <p className="text-sm leading-relaxed">{originalText}</p>

      {/* Reply section - only show for owned videos */}
      {canReply && !isPosted && (
        <div className="space-y-2 pt-2 border-t border-border/50">
          {error && (
            <div className="text-xs text-destructive">{error}</div>
          )}
          {successMessage && (
            <div className="text-xs text-success">{successMessage}</div>
          )}
          {reply ? (
            <>
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                className="min-h-[80px] resize-none"
                placeholder="Edit your reply..."
                disabled={isPosting}
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleGenerateReply}
                  variant="outline"
                  size="sm"
                  disabled={isGenerating || isPosting}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 mr-1" />
                      Regenerate
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                  onClick={handleSendReply}
                  disabled={isPosting || !reply.trim()}
                >
                  {isPosting ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    "Post Reply"
                  )}
                </Button>
              </div>
            </>
          ) : (
            <Button
              onClick={handleGenerateReply}
              variant="outline"
              size="sm"
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                  Generating reply...
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 mr-2" />
                  Generate Reply
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Posted confirmation or existing reply */}
      {(isPosted || postedReply) && (
        <div className="pt-2 border-t border-border/50 space-y-2">
          <div className="text-sm text-success font-medium">✓ Reply posted to YouTube</div>
          {postedReply && (
            <div className="bg-secondary/30 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Replied with:</div>
              <p className="text-sm">{postedReply.replyText}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentWithReply;
