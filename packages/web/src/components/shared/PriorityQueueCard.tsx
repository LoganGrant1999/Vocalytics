import { Button } from "@/components/ui/button";
import CommentRow from "./CommentRow";

interface PriorityQueueCardProps {
  plan: "free" | "pro";
}

const mockComments = [
  {
    commenterHandle: "@filmnerd92",
    timestamp: "2h ago",
    likes: 34,
    badges: ["Top Fan", "Question"],
    originalText: "This tutorial saved my project! Quick question - what LUT are you using for the color grade? Would love to match this look.",
    draftedReply: "You're insane 😂 appreciate you big time! The LUT is FilmConvert Nitrate - Cinema pack. More coming soon 🙏",
  },
  {
    commenterHandle: "@techsteve",
    timestamp: "5h ago",
    likes: 89,
    badges: ["Sponsor mention"],
    originalText: "Just wanted to say thanks for mentioning Riverside in this video. I've been using it since your recommendation and it's a game changer for my podcast!",
    draftedReply: "That's awesome to hear! Riverside really levels up the audio quality. Keep crushing it with the podcast 🔥",
  },
  {
    commenterHandle: "@creativemind",
    timestamp: "8h ago",
    likes: 12,
    badges: ["Question"],
    originalText: "Can you share more about your lighting setup? The soft light on the left looks amazing.",
    draftedReply: "Thanks! It's a single Aputure 300d with a lantern modifier. Super simple but gives that wrap-around glow. More lighting tutorials coming soon 👊",
  },
];

const PriorityQueueCard = ({ plan }: PriorityQueueCardProps) => {
  const handleSendAll = () => {
    console.log("TODO: batch POST /api/youtube/reply");
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">High-Priority Replies</h3>
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {mockComments.length} ready
          </span>
        </div>
        
        <Button
          onClick={handleSendAll}
          disabled={plan === "free"}
          className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {plan === "free" ? "Send All (Pro only)" : "Send All Approved"}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        We pull the comments that matter most. You approve the replies. We send them for you.
      </p>
      {/* TODO: GET /api/youtube/comments + POST /api/analyze-comments + POST /api/generate-replies */}

      {/* Comments list */}
      <div className="space-y-0">
        {mockComments.map((comment, idx) => (
          <CommentRow key={idx} {...comment} />
        ))}
      </div>

      {/* Footer note */}
      <p className="text-xs text-muted-foreground mt-6 text-center">
        Replies post from your channel. We space timing so it looks natural.
      </p>
    </div>
  );
};

export default PriorityQueueCard;
