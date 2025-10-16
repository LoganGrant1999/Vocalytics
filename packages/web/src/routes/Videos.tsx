import { VideoIdInput } from '@/components/VideoIdInput';
import { useChannelData } from '@/hooks/useChannelData';
import { VideoCard } from '@/components/VideoCard';
import { ConnectYouTubeButton } from '@/components/ConnectYouTubeButton';
import { Video, Loader2, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function Videos() {
  const navigate = useNavigate();
  const { videos, channelTitle, isLoading, isYouTubeNotConnected } = useChannelData();

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

      {/* Your Uploads Grid */}
      {isLoading ? (
        <div className="rounded-lg border p-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Loading your videos...</p>
            </div>
          </div>
        </div>
      ) : isYouTubeNotConnected ? (
        <div className="rounded-lg border p-6">
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Video className="h-16 w-16 mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">Connect Your YouTube Channel</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Connect your YouTube account to see your uploads here. You can still analyze any video using the form below.
            </p>
            <ConnectYouTubeButton size="lg" />
          </div>
        </div>
      ) : videos.length > 0 ? (
        <div className="rounded-lg border p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Your Recent Uploads</h3>
            {channelTitle && (
              <p className="text-sm text-muted-foreground mt-1">
                Connected as <span className="font-medium">{channelTitle}</span>
              </p>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => (
              <VideoCard
                key={video.videoId}
                video={video}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Manual Input (always available as fallback) */}
      <div className="space-y-6">
        <div className="rounded-lg border p-6 bg-muted/50">
          <h3 className="text-lg font-semibold mb-2">Analyze Any Video</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Enter a YouTube video URL or ID to analyze its comments.
          </p>
          <VideoIdInput />
        </div>
      </div>
    </div>
  );
}
