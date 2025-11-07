import { Button } from "@/components/ui/button";
import CommentRow from "@/components/shared/CommentRow";

interface CommentsPageProps {
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
  {
    commenterHandle: "@podcastpro",
    timestamp: "10h ago",
    likes: 56,
    badges: ["Top Fan"],
    originalText: "Been watching since 5k subs. You've come so far! This production quality is insane.",
    draftedReply: "Appreciate you big time for being here since day one 🙏 You're insane for sticking with me!",
  },
  {
    commenterHandle: "@videoedit101",
    timestamp: "12h ago",
    likes: 23,
    badges: ["Question"],
    originalText: "What timeline settings do you use in Premiere? My 4K footage is super laggy.",
    draftedReply: "I use proxies for everything! Generate 1/4 res proxies on ingest. Makes editing butter smooth. More coming soon on my workflow 👊",
  },
];

const CommentsPage = ({ plan }: CommentsPageProps) => {
  const handleSendAll = () => {
    console.log("TODO: batch POST /api/youtube/reply");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">All Recent Comments</h1>
          <p className="text-muted-foreground">Approve and send replies in bulk.</p>
        </div>
        <Button
          onClick={handleSendAll}
          disabled={plan === "free"}
          className="bg-primary hover:bg-primary/90 disabled:opacity-50"
        >
          {plan === "free" ? "Send All (Pro only)" : "Send All Approved"}
        </Button>
      </div>
      {/* TODO: GET /api/youtube/comments + POST /api/analyze-comments + POST /api/generate-replies */}

      {/* Comments list */}
      <div className="rounded-2xl border border-border bg-card p-6">
        {mockComments.map((comment, idx) => (
          <CommentRow key={idx} {...comment} />
        ))}
      </div>

      {/* Footer note */}
      <p className="text-sm text-muted-foreground text-center">
        Replies post from your YouTube account. We space them out to look natural.
      </p>
    </div>
  );
};

export default CommentsPage;
