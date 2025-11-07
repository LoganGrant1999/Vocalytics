import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

interface CommentRowProps {
  commenterHandle: string;
  timestamp: string;
  likes: number;
  badges: string[];
  originalText: string;
  draftedReply: string;
  approved?: boolean;
}

const CommentRow = ({
  commenterHandle,
  timestamp,
  likes,
  badges,
  originalText,
  draftedReply,
  approved: initialApproved = false,
}: CommentRowProps) => {
  const [approved, setApproved] = useState(initialApproved);
  const [reply, setReply] = useState(draftedReply);

  return (
    <div className="border-b border-border py-6 first:pt-0 last:border-b-0">
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
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          className="min-h-[80px] resize-none bg-secondary/50 border-border"
          placeholder="Edit reply..."
        />
        {/* TODO: draftedReply from POST /api/generate-replies */}
      </div>

      {/* Approve checkbox */}
      <div className="flex items-center gap-2">
        <Checkbox
          id={`approve-${commenterHandle}`}
          checked={approved}
          onCheckedChange={(checked) => setApproved(checked as boolean)}
        />
        <label
          htmlFor={`approve-${commenterHandle}`}
          className="text-sm font-medium cursor-pointer"
        >
          Approve reply
        </label>
      </div>
    </div>
  );
};

export default CommentRow;
