import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { extractYouTubeId } from "@/lib/youtube";
import { Search, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import api from "@/lib/api";

interface AnalysisResult {
  videoId: string;
  sentiment: string;
  score: number;
  summary: string;
  totalComments: number;
  analyzedAt: string;
}

const VideoAnalysisInput = () => {
  const [input, setInput] = useState("");
  const [debouncedInput, setDebouncedInput] = useState("");
  const [validationState, setValidationState] = useState<
    "idle" | "valid" | "invalid"
  >("idle");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);

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

  const handleAnalyze = async () => {
    const videoId = extractYouTubeId(input);
    if (!videoId) return;

    setIsAnalyzing(true);
    setError("");
    setResult(null);

    try {
      const data = await api.analyzeComments({ videoId });
      setResult(data);
    } catch (err: any) {
      console.error("Failed to analyze video:", err);
      setError(err.message || "Failed to analyze video");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && validationState === "valid" && !isAnalyzing) {
      handleAnalyze();
    }
  };

  const getSentimentColor = (sentiment: string) => {
    const lower = sentiment.toLowerCase();
    if (lower.includes("positive")) return "text-green-600";
    if (lower.includes("negative")) return "text-red-600";
    return "text-yellow-600";
  };

  const getSentimentBgColor = (sentiment: string) => {
    const lower = sentiment.toLowerCase();
    if (lower.includes("positive")) return "bg-green-50 border-green-200";
    if (lower.includes("negative")) return "bg-red-50 border-red-200";
    return "bg-yellow-50 border-yellow-200";
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
                disabled={isAnalyzing}
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
              disabled={validationState !== "valid" || isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Analyze
                </>
              )}
            </Button>
          </div>

          {validationState === "invalid" && (
            <p className="text-sm text-destructive">
              Invalid YouTube video URL or ID
            </p>
          )}
          {validationState === "valid" && !result && (
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

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results Display */}
      {result && (
        <Card className={`p-6 border-2 ${getSentimentBgColor(result.sentiment)}`}>
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-1">Analysis Complete</h3>
                <p className="text-sm text-muted-foreground">
                  Video ID: {result.videoId}
                </p>
              </div>
              <div className={`text-2xl font-bold ${getSentimentColor(result.sentiment)}`}>
                {result.sentiment}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Sentiment Score</span>
                <span className={`font-semibold ${getSentimentColor(result.sentiment)}`}>
                  {result.score.toFixed(1)}/10
                </span>
              </div>
              <Progress value={result.score * 10} className="h-2" />
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Summary</h4>
              <p className="text-sm text-muted-foreground">{result.summary}</p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t text-sm">
              <span className="text-muted-foreground">
                {result.totalComments} comments analyzed
              </span>
              <span className="text-muted-foreground">
                {new Date(result.analyzedAt).toLocaleString()}
              </span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default VideoAnalysisInput;
