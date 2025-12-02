import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { extractYouTubeId } from "@/lib/youtube";
import { Search, AlertCircle, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";

const VideoAnalysisInput = () => {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [debouncedInput, setDebouncedInput] = useState("");
  const [validationState, setValidationState] = useState<
    "idle" | "valid" | "invalid"
  >("idle");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Debounce input changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedInput(input);
    }, 300);

    return () => clearTimeout(timer);
  }, [input]);

  // Validate debounced input
  useEffect(() => {
    if (!debouncedInput.trim()) {
      setValidationState("idle");
      return;
    }

    const videoId = extractYouTubeId(debouncedInput);
    setValidationState(videoId ? "valid" : "invalid");
  }, [debouncedInput]);

  const handleAnalyze = () => {
    const videoId = extractYouTubeId(input);
    if (!videoId) return;

    // Start analysis and navigate immediately - don't wait
    setIsAnalyzing(true);

    // Trigger analysis in background (fire and forget)
    api.analyzeVideo(videoId).catch(err => console.error('Analysis failed:', err));

    // Navigate immediately with a flag to trigger re-fetch
    navigate(`/app/video/${videoId}?analyzing=true`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && validationState === "valid") {
      handleAnalyze();
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-2">Analyze Any Video</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Enter a YouTube video URL or ID to analyze its comments.
        </p>

        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://youtube.com/watch?v=... or video ID"
                className="pr-10"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {validationState === "valid" && (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                )}
                {validationState === "invalid" && (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
              </div>
            </div>
            <Button
              onClick={handleAnalyze}
              disabled={validationState !== "valid"}
            >
              <Search className="mr-2 h-4 w-4" />
              Analyze
            </Button>
          </div>

          {validationState === "invalid" && (
            <p className="text-sm text-destructive">
              Invalid YouTube video URL or ID
            </p>
          )}
          {validationState === "valid" && (
            <p className="text-sm text-green-600">
              Valid video ID: {extractYouTubeId(input)}
            </p>
          )}

          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">Supported formats:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Full URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ</li>
              <li>Short URL: https://youtu.be/dQw4w9WgXcQ</li>
              <li>Video ID only: dQw4w9WgXcQ</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default VideoAnalysisInput;
