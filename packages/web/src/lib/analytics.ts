import posthog from 'posthog-js';

/**
 * Analytics events tracked throughout the application.
 * Each event represents a step in the user journey.
 */
export type AnalyticsEvent =
  | { name: 'connect_started' }
  | { name: 'connect_success'; properties?: { scopes?: string[] } }
  | { name: 'analyze_started'; properties?: { videoId?: string } }
  | { name: 'analyze_success'; properties?: { videoId?: string; commentCount?: number } }
  | { name: 'analyze_failure'; properties?: { videoId?: string; error?: string } }
  | { name: 'replies_generated'; properties?: { commentId?: string; replyCount?: number } }
  | { name: 'paywall_viewed'; properties?: { context?: string } }
  | { name: 'checkout_started' }
  | { name: 'checkout_success' }
  | { name: 'checkout_failure'; properties?: { error?: string } };

/**
 * Initialize PostHog analytics.
 * Should be called once at app startup.
 */
export function initAnalytics() {
  const apiKey = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST;

  if (!apiKey) {
    // No analytics in development or if not configured
    console.info('[Analytics] PostHog not configured, analytics disabled');
    return;
  }

  posthog.init(apiKey, {
    api_host: host || 'https://app.posthog.com',
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false, // We'll manually track important events
    loaded: (posthog) => {
      if (import.meta.env.DEV) {
        posthog.debug();
      }
    },
  });
}

/**
 * Track a custom analytics event.
 * All events are typed to ensure consistent tracking.
 */
export function trackEvent(event: AnalyticsEvent) {
  if (!posthog.__loaded) {
    // Analytics not initialized or disabled
    return;
  }

  posthog.capture(event.name, 'properties' in event ? event.properties : undefined);
}

/**
 * Identify the current user for analytics.
 * Should be called after successful authentication.
 */
export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (!posthog.__loaded) {
    return;
  }

  posthog.identify(userId, properties);
}

/**
 * Reset the analytics session.
 * Should be called on logout.
 */
export function resetAnalytics() {
  if (!posthog.__loaded) {
    return;
  }

  posthog.reset();
}
