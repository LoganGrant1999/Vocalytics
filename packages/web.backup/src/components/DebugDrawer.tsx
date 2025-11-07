import { useState, useEffect } from 'react';
import { X, Copy, Check, Bug, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { requestStore } from '@/lib/requestStore';
import { toast } from 'sonner';

interface DebugDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Debug drawer showing the last 5 API requests with their details.
 * Allows copying request IDs for support debugging.
 */
export function DebugDrawer({ isOpen, onClose }: DebugDrawerProps) {
  const [records, setRecords] = useState(requestStore.getRecords());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = requestStore.subscribe(() => {
      setRecords(requestStore.getRecords());
    });

    return unsubscribe;
  }, []);

  const handleCopy = async (requestId: string | null) => {
    if (!requestId) return;

    try {
      await navigator.clipboard.writeText(requestId);
      setCopiedId(requestId);
      toast.success('Request ID copied!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleClear = () => {
    requestStore.clear();
    toast.success('Debug history cleared');
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 bottom-0 w-96 bg-background border-l z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Debug Console</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {records.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No requests yet</p>
              <p className="text-xs mt-1">Recent API calls will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((record, index) => (
                <div
                  key={index}
                  className="rounded-lg border p-3 bg-card hover:bg-accent/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-mono font-semibold px-2 py-0.5 rounded"
                        style={{
                          backgroundColor:
                            record.method === 'GET'
                              ? '#dbeafe'
                              : record.method === 'POST'
                                ? '#d1fae5'
                                : '#fef3c7',
                          color:
                            record.method === 'GET'
                              ? '#1e40af'
                              : record.method === 'POST'
                                ? '#065f46'
                                : '#92400e',
                        }}
                      >
                        {record.method}
                      </span>
                      <span
                        className="text-xs font-mono px-2 py-0.5 rounded"
                        style={{
                          backgroundColor:
                            record.status >= 200 && record.status < 300
                              ? '#d1fae5'
                              : record.status >= 400 && record.status < 500
                                ? '#fed7aa'
                                : '#fee2e2',
                          color:
                            record.status >= 200 && record.status < 300
                              ? '#065f46'
                              : record.status >= 400 && record.status < 500
                                ? '#9a3412'
                                : '#991b1b',
                        }}
                      >
                        {record.status}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(record.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <p className="text-sm font-mono mb-2 break-all">{record.path}</p>

                  {record.requestId && (
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                        {record.requestId}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(record.requestId)}
                      >
                        {copiedId === record.requestId ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {records.length > 0 && (
          <div className="p-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear History
            </Button>
          </div>
        )}
      </aside>
    </>
  );
}
