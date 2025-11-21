/**
 * API Client for Vocalytics Backend
 * All API calls go through /api (proxied in dev, same domain in prod)
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface ApiError {
  error: string;
  message: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Important: send HTTP-only cookies
    };

    try {
      const response = await fetch(url, config);

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return {} as T;
      }

      const data = await response.json();

      if (!response.ok) {
        const error = data as ApiError;
        throw new Error(error.message || error.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // ========================================
  // AUTH ENDPOINTS
  // ========================================

  async register(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) {
    return this.request<{
      user: {
        id: string;
        email: string;
        name: string;
        tier: 'free' | 'pro';
        emailVerified: boolean;
      };
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: { email: string; password: string }) {
    return this.request<{
      user: {
        id: string;
        email: string;
        name: string;
        tier: 'free' | 'pro';
        emailVerified: boolean;
        hasYouTubeConnected: boolean;
      };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async logout() {
    return this.request<{ message: string }>('/auth/logout', {
      method: 'POST',
    });
  }

  async getCurrentUser() {
    return this.request<{
      user: {
        id: string;
        email: string;
        name: string;
        avatar?: string;
        tier: 'free' | 'pro';
        emailVerified: boolean;
        hasYouTubeConnected: boolean;
        createdAt: string;
      };
      quota?: {
        analyze_weekly_count: number;
        analyze_weekly_limit: number;
        reply_daily_count: number;
        reply_daily_limit: number;
        period_start: string;
      };
    }>('/auth/me');
  }

  // ========================================
  // YOUTUBE ENDPOINTS
  // ========================================

  getYouTubeOAuthUrl(): string {
    return `${this.baseUrl}/youtube/connect`;
  }

  async getVideos(params?: { mine?: boolean; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.mine !== undefined) query.set('mine', String(params.mine));
    if (params?.limit) query.set('limit', String(params.limit));

    return this.request<
      Array<{
        videoId: string;
        title: string;
        thumbnailUrl: string;
        publishedAt: string;
        stats: {
          viewCount?: number;
          likeCount?: number;
          commentCount?: number;
        };
      }>
    >(`/youtube/videos?${query}`);
  }

  async getComments(params: {
    videoId: string;
    pageToken?: string;
    includeReplies?: boolean;
    order?: 'time' | 'relevance';
  }) {
    const query = new URLSearchParams({
      videoId: params.videoId,
    });
    if (params.pageToken) query.set('pageToken', params.pageToken);
    if (params.includeReplies !== undefined)
      query.set('includeReplies', String(params.includeReplies));
    if (params.order) query.set('order', params.order);

    return this.request<{
      items: Array<any>;
      nextPageToken?: string;
      pageInfo?: {
        totalResults: number;
        resultsPerPage: number;
      };
    }>(`/youtube/comments?${query}`);
  }

  async getPublicComments(params: {
    videoId: string;
    maxResults?: number;
    order?: 'time' | 'relevance';
  }) {
    const query = new URLSearchParams({
      videoId: params.videoId,
    });
    if (params.maxResults) query.set('maxResults', String(params.maxResults));
    if (params.order) query.set('order', params.order);

    return this.request<{
      items: Array<any>;
      nextPageToken?: string;
      pageInfo?: {
        totalResults: number;
        resultsPerPage: number;
      };
    }>(`/youtube/public-comments?${query}`);
  }

  async postReply(data: { parentId: string; text: string }) {
    return this.request<{
      success: boolean;
      comment: any;
    }>('/youtube/reply', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ========================================
  // ANALYSIS ENDPOINTS
  // ========================================

  async analyzeComments(data: {
    comments: Array<{ id: string; text: string }>;
  }) {
    return this.request<
      Array<{
        commentId: string;
        sentiment: {
          label: 'positive' | 'neutral' | 'negative';
          positive: number;
          neutral: number;
          negative: number;
        };
        topics: string[];
        intent: string;
        toxicity: number;
        category: string;
      }>
    >('/analyze-comments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getVideoAnalysis(videoId: string) {
    return this.request<{
      videoId: string;
      analyzedAt: string;
      sentiment: {
        pos: number;
        neu: number;
        neg: number;
      };
      score: number;
      topPositive: Array<{
        commentId: string;
        text: string;
        author: string;
        publishedAt: string;
        likeCount: number;
        sentiment: {
          pos: number;
          neu: number;
          neg: number;
        };
      }>;
      topNegative: Array<{
        commentId: string;
        text: string;
        author: string;
        publishedAt: string;
        likeCount: number;
        sentiment: {
          pos: number;
          neu: number;
          neg: number;
        };
      }>;
      summary: string;
      categoryCounts: {
        pos: number;
        neu: number;
        neg: number;
      };
      totalComments?: number;
    }>(`/analysis/${videoId}`);
  }

  async analyzeVideo(videoId: string) {
    return this.request<{
      videoId: string;
      analyzedAt: string;
      sentiment: {
        pos: number;
        neu: number;
        neg: number;
      };
      score: number;
      topPositive: Array<{
        commentId: string;
        text: string;
        author: string;
        publishedAt: string;
        likeCount: number;
        sentiment: {
          pos: number;
          neu: number;
          neg: number;
        };
      }>;
      topNegative: Array<{
        commentId: string;
        text: string;
        author: string;
        publishedAt: string;
        likeCount: number;
        sentiment: {
          pos: number;
          neu: number;
          neg: number;
        };
      }>;
      summary: string;
    }>(`/analysis/${videoId}`, {
      method: 'POST',
    });
  }

  async listAnalyses() {
    return this.request<
      Array<{
        videoId: string;
        analyzedAt: string;
        sentiment: {
          pos: number;
          neu: number;
          neg: number;
        };
        score: number;
        summary: string;
        title?: string;
        thumbnailUrl?: string;
        publishedAt?: string;
      }>
    >('/analysis');
  }

  async generateReplies(data: {
    videoId: string;
    commentIds: string[];
    tone?: string;
  }) {
    return this.request<{
      replies: Array<{
        commentId: string;
        originalComment: string;
        suggestedReply: string;
      }>;
    }>('/generate-replies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ========================================
  // USER/SUBSCRIPTION ENDPOINTS
  // ========================================

  async getSubscription() {
    return this.request<{
      tier: 'free' | 'pro';
      subscription_status: string;
      subscribed_until?: string;
      next_payment_date?: string;
      cancel_at_period_end: boolean;
      stripe_customer_id?: string;
      stripe_subscription_id?: string;
      scopes: string[];
    }>('/me/subscription');
  }

  async getUsage() {
    return this.request<{
      analyze_weekly_count: number;
      analyze_weekly_limit: number;
      reply_daily_count: number;
      reply_daily_limit: number;
      period_start: string;
    }>('/me/usage');
  }

  // ========================================
  // BILLING ENDPOINTS
  // ========================================

  async createCheckoutSession() {
    return this.request<{
      sessionId: string;
      url: string;
    }>('/billing/checkout', {
      method: 'POST',
    });
  }

  async createPortalSession() {
    return this.request<{
      url: string;
    }>('/billing/portal', {
      method: 'POST',
    });
  }
}

export const api = new ApiClient(API_BASE_URL);
export default api;
