import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";

interface CommentWithReplyProps {
  commenterHandle: string;
  timestamp: string;
  likes: number;
  originalText: string;
  sentiment?: "positive" | "negative";
}

const CommentWithReply = ({
  commenterHandle,
  timestamp,
  likes,
  originalText,
  sentiment,
}: CommentWithReplyProps) => {
  const [reply, setReply] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateReply = async () => {
    setIsGenerating(true);
    // TODO: POST /api/generate-replies
    console.log("TODO: POST /api/generate-replies for comment:", originalText);
    
    // Simulate API call
    setTimeout(() => {
      const mockReply = sentiment === "positive" 
        ? "Thanks so much! Really appreciate you watching and taking the time to comment 🙏 More content coming soon!"
        : "Hey, thanks for the feedback! I appreciate you sharing your thoughts. I'll definitely keep this in mind for future videos 👊";
      setReply(mockReply);
      setIsGenerating(false);
    }, 1500);
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

      {/* Reply section */}
      <div className="space-y-2 pt-2 border-t border-border/50">
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
              <Button size="sm" className="bg-primary hover:bg-primary/90">
                Approve & Send
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
    </div>
  );
};

export default CommentWithReply;
