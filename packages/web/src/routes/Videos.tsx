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
    <div className="px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-1 text-brand-text-primary">Videos Dashboard</h1>
        <p className="text-brand-text-secondary">
          Analyze your recent uploads and track sentiment across comments.
        </p>
      </div>

      {/* Your Uploads Grid */}
      {isLoading ? (
        <div className="rounded-xl border border-brand-border bg-brand-surface p-6 shadow-card mb-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-brand-text-secondary" />
              <p className="text-brand-text-secondary">Loading your videos...</p>
            </div>
          </div>
        </div>
      ) : isYouTubeNotConnected ? (
        <div className="rounded-xl border border-brand-border bg-brand-surface p-6 shadow-card mb-6">
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Video className="h-16 w-16 mb-4 text-brand-text-secondary" />
            <h3 className="text-xl font-semibold mb-2 text-brand-text-primary">Connect Your YouTube Channel</h3>
            <p className="text-brand-text-secondary text-center mb-6 max-w-md">
              Connect your YouTube account to see your uploads here. You can still analyze any video using the form below.
            </p>
            <ConnectYouTubeButton size="lg" />
          </div>
        </div>
      ) : videos.length > 0 ? (
        <div className="mb-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-brand-text-primary">Your Recent Uploads</h3>
            {channelTitle && (
              <p className="text-sm text-brand-text-secondary mt-1">
                Connected as <span className="font-medium">{channelTitle}</span>
              </p>
            )}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6">
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
      <div className="rounded-xl border border-brand-border bg-brand-bg-alt p-6 shadow-card">
        <h3 className="text-lg font-semibold mb-2 text-brand-text-primary">Analyze Any Video</h3>
        <p className="text-sm text-brand-text-secondary mb-4">
          Enter a YouTube video URL or ID to analyze its comments.
        </p>
        <VideoIdInput />
      </div>
    </div>
  );
}
