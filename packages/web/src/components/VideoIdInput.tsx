import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { extractYouTubeId } from '@/lib/youtube';
import { Search, AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * Input component for pasting YouTube video URL or ID.
 * Validates and extracts video ID, then navigates to analyze page.
 */
export function VideoIdInput() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [debouncedInput, setDebouncedInput] = useState('');
  const [validationState, setValidationState] = useState<
    'idle' | 'valid' | 'invalid'
  >('idle');

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
      setValidationState('idle');
      return;
    }

    const videoId = extractYouTubeId(debouncedInput);
    setValidationState(videoId ? 'valid' : 'invalid');
  }, [debouncedInput]);

  const handleAnalyze = () => {
    const videoId = extractYouTubeId(input);
    if (videoId) {
      navigate(`/analyze/${videoId}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && validationState === 'valid') {
      handleAnalyze();
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="video-id" className="text-sm font-medium">
          YouTube Video URL or ID
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              id="video-id"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://youtube.com/watch?v=... or dQw4w9WgXcQ"
              className="w-full px-3 py-2 pr-10 border border-brand-border rounded-xl bg-brand-surface text-brand-text-primary placeholder:text-brand-text-secondary focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {validationState === 'valid' && (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              )}
              {validationState === 'invalid' && (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
            </div>
          </div>
          <Button
            onClick={handleAnalyze}
            disabled={validationState !== 'valid'}
          >
            <Search className="mr-2 h-4 w-4" />
            Analyze
          </Button>
        </div>
        {validationState === 'invalid' && (
          <p className="text-sm text-destructive">
            Invalid YouTube video URL or ID
          </p>
        )}
        {validationState === 'valid' && (
          <p className="text-sm text-green-600">
            Valid video ID: {extractYouTubeId(input)}
          </p>
        )}
      </div>

      <div className="text-sm text-muted-foreground">
        <p className="font-medium mb-1">Supported formats:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Full URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ</li>
          <li>Short URL: https://youtu.be/dQw4w9WgXcQ</li>
          <li>Video ID only: dQw4w9WgXcQ</li>
        </ul>
      </div>
    </div>
  );
}
