import { VideoIdInput } from '@/components/VideoIdInput';

export default function Videos() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Your Videos</h2>
          <p className="text-muted-foreground">
            Select a video to analyze comments
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-lg border p-6 bg-muted/50">
          <p className="text-sm text-muted-foreground mb-4">
            Enter a YouTube video URL or ID to analyze its comments.
          </p>
          <VideoIdInput />
        </div>
      </div>
    </div>
  );
}
