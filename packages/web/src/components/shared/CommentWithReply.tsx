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
}: CommentWithReplyProps) => {
  const [reply, setReply] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSendReply = () => {
    console.log("TODO: POST /api/youtube/reply with commentId:", commentId, "reply:", reply);
    // Placeholder for future implementation
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
      {canReply && (
        <div className="space-y-2 pt-2 border-t border-border/50">
          {error && (
            <div className="text-xs text-destructive">{error}</div>
          )}
          {reply ? (
            <>
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                className="min-h-[80px] resize-none"
                placeholder="Edit your reply..."
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleGenerateReply}
                  variant="outline"
                  size="sm"
                  disabled={isGenerating}
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
                >
                  Send (Coming Soon)
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
    </div>
  );
};

export default CommentWithReply;
