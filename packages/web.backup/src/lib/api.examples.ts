/**
 * Example usage test stub for the typed API client.
 * This demonstrates how to use the API client with full type safety.
 */

import { api } from './api';
import { normalizeApiError, isApiError } from './errors';

/**
 * Example: Health check endpoint
 * Demonstrates basic GET request with typed response
 */
async function exampleHealthCheck() {
  const { data, error } = await api.GET('/healthz');

  if (error) {
    const normalizedError = normalizeApiError(error);
    console.error('Health check failed:', normalizedError);
    return;
  }

  if (data) {
    // TypeScript knows the exact shape of data:
    // { ok?: boolean; version?: string; time?: string; db?: "ok" | "error" | "unknown"; ... }
    console.log('Health check passed:', {
      ok: data.ok,
      version: data.version,
      db: data.db,
    });
  }
}

/**
 * Example: Analyze comments with sentiment analysis
 * Demonstrates POST request with body and typed response
 */
async function exampleAnalyzeComments() {
  const { data, error } = await api.POST('/api/analyze-comments', {
    body: {
      comments: [
        {
          id: 'comment-123',
          text: 'This video is amazing!',
          author: 'John Doe',
          publishedAt: '2025-01-01T00:00:00Z',
        },
        {
          id: 'comment-456',
          text: 'Not sure about this...',
          author: 'Jane Smith',
          publishedAt: '2025-01-02T00:00:00Z',
        },
      ],
    },
  });

  if (error) {
    const normalizedError = normalizeApiError(error);

    // Check if it's a rate limit error
    if (isApiError(normalizedError) && normalizedError.error === 'RATE_LIMIT_EXCEEDED') {
      console.error('Rate limit exceeded. Please upgrade your plan.');
      return;
    }

    console.error('Analysis failed:', normalizedError);
    return;
  }

  if (data && data.sentiments) {
    // TypeScript knows the shape of the analysis response
    console.log('Analysis complete:');
    data.sentiments.forEach((sentiment) => {
      console.log(`Comment ${sentiment.commentId}: ${sentiment.label} (${sentiment.score})`);
    });
  }
}

/**
 * Example: Generate AI replies for comments
 * Demonstrates POST request with complex body
 */
async function exampleGenerateReplies() {
  const { data, error } = await api.POST('/api/generate-replies', {
    body: {
      comments: [
        {
          id: 'comment-123',
          text: 'This video is amazing!',
          author: 'John Doe',
          publishedAt: '2025-01-01T00:00:00Z',
        },
      ],
      videoContext: {
        title: 'My Awesome Video',
        description: 'A video about coding',
      },
    },
  });

  if (error) {
    const normalizedError = normalizeApiError(error);
    console.error('Reply generation failed:', normalizedError);
    return;
  }

  if (data && data.replies) {
    // TypeScript knows the shape of the reply response
    data.replies.forEach((reply) => {
      console.log(`Reply for ${reply.commentId}: ${reply.text}`);
    });
  }
}

// Export examples for use in components
export {
  exampleHealthCheck,
  exampleAnalyzeComments,
  exampleGenerateReplies,
};
