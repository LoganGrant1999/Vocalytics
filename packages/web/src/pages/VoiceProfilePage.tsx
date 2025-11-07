import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Youtube, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

const VoiceProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const hasYouTubeConnected = user?.hasYouTubeConnected || false;

  const [tone, setTone] = useState("hype");
  const [emojiLevel, setEmojiLevel] = useState([2]);
  const [phrases, setPhrases] = useState(
    "you're insane 😂\nappreciate you big time 🙏\nmore coming soon"
  );

  const handleConnectYouTube = () => {
    navigate("/connect");
  };

  const handleSave = () => {
    console.log("TODO: save updated voice profile to Supabase");
  };

  const emojiLabels = ["None", "Light", "Heavy"];

  if (!hasYouTubeConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Your Voice Profile</h1>
          <p className="text-muted-foreground">
            We learn from your last 50 replies and match tone, length, and emoji style.
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
          We learn from your last 50 replies and match tone, length, and emoji style.
        </p>
      </div>

      {/* Current profile display */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Current Profile</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-1">Tone</div>
            <div className="text-base font-semibold">Friendly / Hype / Casual</div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-1">Typical length</div>
            <div className="text-base font-semibold">1–2 sentences</div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-1">Emoji level</div>
            <div className="text-base font-semibold">High 🔥🙏</div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-1">Signature phrases</div>
            <div className="space-y-1 text-sm">
              <div>"you're insane 😂"</div>
              <div>"appreciate you big time 🙏"</div>
              <div>"more coming soon"</div>
            </div>
          </div>
        </div>
      </div>
      {/* TODO: Voice profile from POST /api/generate-replies + Supabase profile */}

      {/* Editable controls */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
        <h3 className="text-lg font-semibold">Customize Your Voice</h3>

        {/* Tone selector */}
        <div className="space-y-2">
          <Label htmlFor="tone">Tone</Label>
          <Select value={tone} onValueChange={setTone}>
            <SelectTrigger id="tone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="chill">Chill / Laid Back</SelectItem>
              <SelectItem value="hype">Hype / Energetic</SelectItem>
              <SelectItem value="professional">Professional</SelectItem>
            </SelectContent>
          </Select>
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
            placeholder="Enter one phrase per line..."
          />
        </div>

        {/* Save button */}
        <Button
          onClick={handleSave}
          className="w-full bg-primary hover:bg-primary/90"
        >
          Save Voice Settings
        </Button>
      </div>
    </div>
  );
};

export default VoiceProfilePage;
