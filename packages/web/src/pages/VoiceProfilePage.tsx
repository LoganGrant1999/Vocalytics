import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Youtube, AlertCircle, Crown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

const VoiceProfilePage = () => {
  const { user } = useAuth();
  const isPro = user?.tier === 'pro';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasYouTubeConnected = user?.hasYouTubeConnected || false;

  const [tone, setTone] = useState("");
  const [emojiLevel, setEmojiLevel] = useState([1]);
  const [replyLength, setReplyLength] = useState([1]);
  const [phrases, setPhrases] = useState("");

  const emojiLabels = ["None", "Light", "Heavy"];
  const lengthLabels = ["A few words", "1-2 sentences", "5+ sentences"];

  // Fetch current tone profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ['toneProfile'],
    queryFn: () => api.getToneProfile(),
    enabled: hasYouTubeConnected,
    retry: false,
  });

  // Load profile data into form when fetched
  useEffect(() => {
    if (profile) {
      if (profile.tone) setTone(profile.tone);

      // Map emoji_usage back to slider value
      const emojiMap: Record<string, number> = { 'none': 0, 'light': 1, 'heavy': 2 };
      if (profile.emoji_usage) setEmojiLevel([emojiMap[profile.emoji_usage] ?? 1]);

      // Map avg_reply_length back to slider value
      const lengthMap: Record<string, number> = { 'short': 0, 'medium': 1, 'long': 2 };
      if (profile.avg_reply_length) setReplyLength([lengthMap[profile.avg_reply_length] ?? 1]);

      // Join phrases with newlines
      if (profile.common_phrases) setPhrases(profile.common_phrases.join('\n'));
    }
  }, [profile]);

  const handleConnectYouTube = () => {
    navigate("/connect");
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () => api.updateToneProfile({
      tone,
      emojiLevel: emojiLevel[0],
      replyLength: replyLength[0],
      phrases,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['toneProfile'] });
    },
  });

  const handleSave = () => {
    saveMutation.mutate();
  };

  if (!hasYouTubeConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Your Voice Profile</h1>
          <p className="text-muted-foreground">
            Customize how AI replies to comments in your voice and style.
          </p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            YouTube account not connected. Please connect to view voice profile.
          </AlertDescription>
        </Alert>
        <Button onClick={handleConnectYouTube}>
          <Youtube className="w-4 h-4 mr-2" />
          Connect YouTube
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Your Voice Profile</h1>
        <p className="text-muted-foreground">
          Customize how AI replies to comments in your voice and style.
        </p>
      </div>

      {/* Current profile display */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Current Profile</h3>
        {isLoading ? (
          <div className="text-muted-foreground">Loading profile...</div>
        ) : profile ? (
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Tone</div>
              <div className="text-base font-semibold">{profile.tone || "Not set"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Typical length</div>
              <div className="text-base font-semibold">
                {profile.avg_reply_length
                  ? profile.avg_reply_length.charAt(0).toUpperCase() + profile.avg_reply_length.slice(1)
                  : "Not set"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Emoji level</div>
              <div className="text-base font-semibold">
                {profile.emoji_usage
                  ? profile.emoji_usage.charAt(0).toUpperCase() + profile.emoji_usage.slice(1)
                  : "Not set"}
                {profile.common_emojis && profile.common_emojis.length > 0
                  ? ` ${profile.common_emojis.slice(0, 3).join(' ')}`
                  : ''}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Signature phrases</div>
              {profile.common_phrases && profile.common_phrases.length > 0 ? (
                <div className="space-y-1 text-sm">
                  {profile.common_phrases.slice(0, 3).map((phrase, i) => (
                    <div key={i}>"{phrase}"</div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No phrases set</div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground">No voice profile yet. Customize your voice below to get started.</div>
        )}
      </div>

      {/* Editable controls */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Customize Your Voice</h3>
          {!isPro && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              <Crown className="w-3 h-3" />
              Pro Only
            </div>
          )}
        </div>

        {!isPro && (
          <Alert>
            <Crown className="h-4 w-4" />
            <AlertDescription>
              Voice profile customization is available for Pro users only. Upgrade to unlock advanced voice customization.
            </AlertDescription>
          </Alert>
        )}

        {/* Tone description */}
        <div className="space-y-2">
          <Label htmlFor="tone">Describe Your Tone</Label>
          <Textarea
            id="tone"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="min-h-[80px] resize-none"
            placeholder="e.g., Friendly and casual, professional but warm, energetic and hype..."
            disabled={!isPro}
          />
          <p className="text-xs text-muted-foreground">
            Describe how you want to sound in your replies
          </p>
        </div>

        {/* Reply length slider */}
        <div className="space-y-2">
          <Label htmlFor="reply-length">
            Typical Reply Length: {lengthLabels[replyLength[0]]}
          </Label>
          <Slider
            id="reply-length"
            min={0}
            max={2}
            step={1}
            value={replyLength}
            onValueChange={setReplyLength}
            className="w-full"
            disabled={!isPro}
          />
        </div>

        {/* Emoji level slider */}
        <div className="space-y-2">
          <Label htmlFor="emoji-level">
            Emoji Level: {emojiLabels[emojiLevel[0]]}
          </Label>
          <Slider
            id="emoji-level"
            min={0}
            max={2}
            step={1}
            value={emojiLevel}
            onValueChange={setEmojiLevel}
            className="w-full"
            disabled={!isPro}
          />
        </div>

        {/* Common phrases */}
        <div className="space-y-2">
          <Label htmlFor="phrases">Common phrases you want us to use</Label>
          <Textarea
            id="phrases"
            value={phrases}
            onChange={(e) => setPhrases(e.target.value)}
            className="min-h-[120px] resize-none"
            placeholder="e.g., you're insane 😂, appreciate you big time 🙏, more coming soon"
            disabled={!isPro}
          />
          <p className="text-xs text-muted-foreground">
            Enter phrases separated by commas or new lines
          </p>
        </div>

        {/* Save button */}
        {isPro ? (
          <>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {saveMutation.isPending ? "Saving..." : "Save Voice Settings"}
            </Button>
            {saveMutation.isSuccess && (
              <p className="text-sm text-green-600 text-center">
                Voice profile saved successfully!
              </p>
            )}
            {saveMutation.isError && (
              <p className="text-sm text-red-600 text-center">
                Failed to save profile. Please try again.
              </p>
            )}
          </>
        ) : (
          <Button
            onClick={() => navigate("/app/billing")}
            className="w-full bg-primary hover:bg-primary/90"
          >
            <Crown className="w-4 h-4 mr-2" />
            Upgrade to Pro
          </Button>
        )}
      </div>
    </div>
  );
};

export default VoiceProfilePage;
