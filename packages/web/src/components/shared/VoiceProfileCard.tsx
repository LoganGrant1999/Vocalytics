import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

const VoiceProfileCard = () => {
  const navigate = useNavigate();

  // Fetch tone profile (same query key as VoiceProfilePage)
  const { data: profile } = useQuery({
    queryKey: ['toneProfile'],
    queryFn: () => api.getToneProfile(),
    retry: false,
  });

  const handleEditSettings = () => {
    navigate("/app/voice");
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-lg font-semibold mb-2">Your Voice Profile</h3>
      <p className="text-sm text-muted-foreground mb-6">
        AI replies match your specified tone, length, and emoji style.
      </p>

      <div className="space-y-4 mb-6">
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Tone</div>
          <div className="text-sm font-semibold">{profile?.tone || "Not set"}</div>
        </div>

        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Typical length</div>
          <div className="text-sm font-semibold">
            {profile?.avg_reply_length
              ? profile.avg_reply_length.charAt(0).toUpperCase() + profile.avg_reply_length.slice(1)
              : "Not set"}
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Emoji level</div>
          <div className="text-sm font-semibold">
            {profile?.emoji_usage
              ? profile.emoji_usage.charAt(0).toUpperCase() + profile.emoji_usage.slice(1)
              : "Not set"}
            {profile?.common_emojis && profile.common_emojis.length > 0
              ? ` ${profile.common_emojis.slice(0, 3).join(' ')}`
              : ''}
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Signature phrases</div>
          {profile?.common_phrases && profile.common_phrases.length > 0 ? (
            <div className="space-y-1">
              {profile.common_phrases.slice(0, 3).map((phrase, i) => (
                <div key={i} className="text-sm">"{phrase}"</div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No phrases set</div>
          )}
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={handleEditSettings}
      >
        Edit Voice Settings
      </Button>
    </div>
  );
};

export default VoiceProfileCard;
