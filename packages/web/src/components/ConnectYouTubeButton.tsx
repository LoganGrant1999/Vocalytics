import { Button } from '@/components/ui/button';
import { Youtube } from 'lucide-react';
import { useState } from 'react';

interface ConnectYouTubeButtonProps {
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  className?: string;
}

/**
 * Button to initiate YouTube OAuth flow.
 * Redirects to GET /api/youtube/connect which handles OAuth.
 */
export function ConnectYouTubeButton({
  size = 'default',
  variant = 'default',
  className,
}: ConnectYouTubeButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    setIsConnecting(true);
    // Redirect to OAuth endpoint - server will handle redirect to Google
    window.location.href = '/api/youtube/connect';
  };

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      onClick={handleConnect}
      disabled={isConnecting}
    >
      <Youtube className="mr-2 h-5 w-5" />
      {isConnecting ? 'Connecting...' : 'Connect YouTube'}
    </Button>
  );
}
