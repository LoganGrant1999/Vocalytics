import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { X, Video } from "lucide-react";

interface CommentRowProps {
  commenterHandle: string;
  timestamp: string;
  likes: number;
  badges: string[];
  originalText: string;
  draftedReply: string;
  videoTitle?: string;
  approved?: boolean;
  onDismiss?: () => void;
  onApprovalChange?: (approved: boolean) => void;
  onReplyChange?: (reply: string) => void;
}

const CommentRow = ({
  commenterHandle,
  timestamp,
  likes,
  badges,
  originalText,
  draftedReply,
  videoTitle,
  approved = false,
  onDismiss,
  onApprovalChange,
  onReplyChange,
}: CommentRowProps) => {

  return (
    <div className="border-b border-border py-6 first:pt-0 last:border-b-0">
      {/* Video title */}
      {videoTitle && (
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
          <Video className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">{videoTitle}</span>
        </div>
      )}

      {/* Original comment */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span className="text-sm font-semibold">{commenterHandle}</span>
          <span className="text-xs text-muted-foreground">{timestamp}</span>
          <span className="text-xs text-muted-foreground">{likes} likes</span>
          {badges.map((badge) => (
            <span
              key={badge}
              className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
            >
              {badge}
            </span>
          ))}
        </div>
        <p className="text-sm text-foreground">{originalText}</p>
      </div>

      {/* AI drafted reply */}
      <div className="mb-3">
        <label className="text-xs font-medium text-muted-foreground mb-2 block">
          AI-Drafted Reply
        </label>
        <Textarea
          value={draftedReply}
          onChange={(e) => onReplyChange?.(e.target.value)}
          className="min-h-[80px] resize-none bg-secondary/50 border-border"
          placeholder={draftedReply ? "" : "Generating reply..."}
        />
      </div>

      {/* Approve checkbox and Dismiss button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`approve-${commenterHandle}`}
            checked={approved}
            onCheckedChange={(checked) => onApprovalChange?.(checked as boolean)}
          />
          <label
            htmlFor={`approve-${commenterHandle}`}
            className="text-sm font-medium cursor-pointer"
          >
            Approve reply
          </label>
        </div>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4 mr-1" />
            Dismiss
          </Button>
        )}
      </div>
    </div>
  );
};

export default CommentRow;
