import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check, Loader2, Send, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useSession } from '@/hooks/useSession';
import type { components } from '@/types/api';

type Comment = components['schemas']['Comment'];

interface Reply {
  commentId?: string;
  text?: string;
}

interface ReplyDraftPanelProps {
  comment: Comment;
  replies: Reply[];
  isLoading: boolean;
  onGenerate: () => void;
}

const ENABLE_POSTING = import.meta.env.VITE_ENABLE_POSTING === 'true';

/**
 * Panel showing AI-generated reply suggestions for a selected comment.
 */
export function ReplyDraftPanel({
  comment,
  replies,
  isLoading,
  onGenerate,
}: ReplyDraftPanelProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [sendingIndex, setSendingIndex] = useState<number | null>(null);
  const { session } = useSession();

  const hasWriteScope = session?.scopes?.includes('https://www.googleapis.com/auth/youtube.force-ssl');

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleSend = async (text: string, index: number) => {
    setSendingIndex(index);
    try {
      const result = await api.POST('/api/youtube/reply', {
        body: {
          parentId: comment.id,
          text,
        },
      });

      if (result.error) {
        throw new Error('Failed to post reply');
      }

      toast.success('Reply posted successfully!');
    } catch (error) {
      toast.error('Failed to post reply', {
        description: 'Please try again or copy and post manually.',
      });
    } finally {
      setSendingIndex(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Original Comment */}
      <div className="rounded-lg border p-4 bg-muted/30">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-sm">{comment.author}</span>
          <span className="text-xs text-muted-foreground">Original comment</span>
        </div>
        <p className="text-sm whitespace-pre-wrap">{comment.text}</p>
      </div>

      {/* Reply Suggestions */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Generating reply suggestions...
          </p>
        </div>
      ) : replies.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground mb-4">
            No reply suggestions yet. Generate some to get started.
          </p>
          <Button onClick={onGenerate}>Generate Replies</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Scope warning banner */}
          {!hasWriteScope && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-orange-900">
                    To post directly, reconnect with additional permission
                  </p>
                  <p className="text-xs text-orange-700 mt-1">
                    Currently you can only copy replies. Grant write access to post directly to YouTube.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => {
                      window.location.href = '/api/youtube/connect?scopes=read+force-ssl';
                    }}
                  >
                    Reconnect with Write Access
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Reply Suggestions</h3>
            <Button size="sm" variant="outline" onClick={onGenerate}>
              Regenerate
            </Button>
          </div>

          {replies.map((reply, index) => (
            <div
              key={index}
              className="rounded-lg border p-4 bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm flex-1 whitespace-pre-wrap">
                  {reply.text || 'No reply text'}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(reply.text || '', index)}
                  >
                    {copiedIndex === index ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                  {ENABLE_POSTING && hasWriteScope && (
                    <Button
                      size="sm"
                      onClick={() => handleSend(reply.text || '', index)}
                      disabled={sendingIndex === index}
                    >
                      {sendingIndex === index ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
