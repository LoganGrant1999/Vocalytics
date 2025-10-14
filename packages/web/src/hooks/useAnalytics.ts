import { useCallback } from 'react';
import { trackEvent, type AnalyticsEvent } from '@/lib/analytics';

/**
 * Hook for tracking analytics events.
 * Provides a typed interface for capturing user actions.
 *
 * @example
 * const analytics = useAnalytics();
 * analytics.track({ name: 'analyze_started', properties: { videoId: 'abc123' } });
 */
export function useAnalytics() {
  const track = useCallback((event: AnalyticsEvent) => {
    trackEvent(event);
  }, []);

  return { track };
}
