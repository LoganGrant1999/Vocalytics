import { AlertCircle, RefreshCw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ApiErrorResponse } from '@/lib/errors';

interface ErrorCalloutProps {
  error: ApiErrorResponse;
  /** Retry callback for transient errors */
  onRetry?: () => void;
  /** Countdown in seconds for 429 rate limiting */
  retryAfter?: number;
}

/**
 * Standardized error display component.
 * Handles different error types with appropriate messaging and actions.
 * Special treatment for 429 (rate limiting) with countdown timer.
 */
export function ErrorCallout({ error, onRetry, retryAfter }: ErrorCalloutProps) {
  const is429 = error.error === 'RateLimitError' || error.message.includes('rate limit');
  const is402 = error.error === 'PaymentRequiredError';

  return (
    <div
      className="rounded-lg border p-4"
      style={{
        borderColor: is429 ? '#f59e0b' : is402 ? '#8b5cf6' : '#ef4444',
        backgroundColor: is429 ? '#fef3c7' : is402 ? '#f3e8ff' : '#fee2e2',
      }}
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          className="h-5 w-5 flex-shrink-0 mt-0.5"
          style={{
            color: is429 ? '#d97706' : is402 ? '#7c3aed' : '#dc2626',
          }}
        />
        <div className="flex-1 space-y-2">
          <div>
            <p
              className="text-sm font-medium"
              style={{
                color: is429 ? '#92400e' : is402 ? '#5b21b6' : '#991b1b',
              }}
            >
              {error.message}
            </p>
            {error.requestId && (
              <p className="text-xs text-muted-foreground mt-1">
                Request ID: <code className="bg-black/5 px-1 rounded">{error.requestId}</code>
              </p>
            )}
          </div>

          {/* 429 Rate Limiting - Show countdown */}
          {is429 && retryAfter !== null && retryAfter !== undefined && retryAfter > 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-800">
              <Clock className="h-4 w-4" />
              <span>
                Please wait <strong>{retryAfter}</strong> second{retryAfter !== 1 ? 's' : ''}{' '}
                before retrying
              </span>
            </div>
          )}

          {/* Retry button */}
          {onRetry && !is402 && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRetry}
              disabled={is429 && retryAfter !== null && retryAfter !== undefined && retryAfter > 0}
              className="mt-2"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
