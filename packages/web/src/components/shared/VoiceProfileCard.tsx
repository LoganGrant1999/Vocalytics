import { Button } from "@/components/ui/button";

const VoiceProfileCard = () => {
  const handleEditSettings = () => {
    console.log("TODO: navigate to VoiceProfilePage");
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-lg font-semibold mb-2">Your Voice Profile</h3>
      <p className="text-sm text-muted-foreground mb-6">
        We match your tone, length, and emoji style from your last 50 replies.
      </p>

      <div className="space-y-4 mb-6">
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Tone</div>
          <div className="text-sm font-semibold">Friendly / Hype / Casual</div>
        </div>
        
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Typical length</div>
          <div className="text-sm font-semibold">1–2 sentences</div>
        </div>
        
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Emoji level</div>
          <div className="text-sm font-semibold">High 🔥🙏</div>
        </div>
        
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Signature phrases</div>
          <div className="space-y-1">
            <div className="text-sm">"you're insane 😂"</div>
            <div className="text-sm">"appreciate you big time 🙏"</div>
            <div className="text-sm">"more coming soon"</div>
          </div>
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={handleEditSettings}
      >
        Edit Voice Settings
      </Button>
      {/* TODO: Voice profile from POST /api/generate-replies + Supabase profile */}
    </div>
  );
};

export default VoiceProfileCard;
