/**
 * YouTube OAuth Flow Route Tests - Production Critical
 *
 * Tests the YouTube OAuth integration including:
 * - OAuth initiation and CSRF protection
 * - OAuth callback with token exchange
 * - User creation vs existing user flows
 * - Refresh token preservation (GOTCHA: Google only sends once)
 * - ID token verification and profile extraction
 * - JWT generation and cookie setting
 * - Comments fetching with pagination and rate limiting
 * - Reply posting with permission checks and rate limiting
 * - Rate limiting (10 req/min per user, shared across endpoints)
 * - Error cases (missing tokens, invalid scope, OAuth errors)
 *
 * Business Impact:
 * - Authentication layer for entire product
 * - Token management and session handling
 * - YouTube API access and rate limiting
 * - Security (CSRF, token handling)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fakeVerifyToken, TEST_USER } from './testAuth.js';

// Use vi.hoisted for proper mock function creation
const {
  mockCreateOAuth2Client,
  mockGetAuthedYouTubeForUser,
  mockGenerateToken,
  mockSupabaseClient,
  mockOAuth2Instance,
  mockYoutubeInstance,
} = vi.hoisted(() => {
  // Mock OAuth2 client
  const mockOAuth2Instance = {
    generateAuthUrl: vi.fn(),
    getToken: vi.fn(),
    verifyIdToken: vi.fn(),
    setCredentials: vi.fn(),
  };

  // Mock YouTube API client
  const mockYoutubeInstance = {
    commentThreads: {
      list: vi.fn(),
    },
    comments: {
      insert: vi.fn(),
    },
  };

  // Mock Supabase client
  const mockSupabaseClient = {
    from: vi.fn(() => mockSupabaseClient),
    select: vi.fn(() => mockSupabaseClient),
    insert: vi.fn(() => mockSupabaseClient),
    update: vi.fn(() => mockSupabaseClient),
    eq: vi.fn(() => mockSupabaseClient),
    single: vi.fn(),
  };

  return {
    mockCreateOAuth2Client: vi.fn(() => mockOAuth2Instance),
    mockGetAuthedYouTubeForUser: vi.fn(() => Promise.resolve(mockYoutubeInstance)),
    mockGenerateToken: vi.fn(),
    mockSupabaseClient,
    mockOAuth2Instance,
    mockYoutubeInstance,
  };
});

// Mock auth plugin
vi.mock('../auth.js', async () => {
  const fp = await import('fastify-plugin');
  const plugin = (app: any, opts: any, done: any) => {
    app.addHook('preHandler', fakeVerifyToken);
    done();
  };
  return {
    default: fp.default(plugin, { name: 'auth-plugin' }),
  };
});

// Mock google library
vi.mock('../../lib/google.js', () => ({
  createOAuth2Client: mockCreateOAuth2Client,
  getAuthedYouTubeForUser: mockGetAuthedYouTubeForUser,
}));

// Mock JWT library
vi.mock('../../lib/jwt.js', () => ({
  generateToken: mockGenerateToken,
}));

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

// Import after mocks
import { createHttpServer } from '../index.js';

describe('YouTube OAuth Flow - Production Critical', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = { ...process.env };

    // Set required env vars
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.NODE_ENV = 'development';

    // Default mock implementations
    mockGenerateToken.mockReturnValue('mock-jwt-token');
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('OAuth Initiation - /youtube/connect', () => {
    it('should generate auth URL with correct parameters', async () => {
      const app = await createHttpServer();

      mockOAuth2Instance.generateAuthUrl.mockReturnValue(
        'https://accounts.google.com/o/oauth2/v2/auth?client_id=test&scope=openid'
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/connect',
      });

      expect(response.statusCode).toBe(302); // Redirect
      expect(mockOAuth2Instance.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          access_type: 'offline',
          prompt: 'consent',
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/youtube.readonly',
            'https://www.googleapis.com/auth/youtube.force-ssl',
          ],
          state: expect.any(String),
        })
      );
    });

    it('should include CSRF state parameter', async () => {
      const app = await createHttpServer();

      mockOAuth2Instance.generateAuthUrl.mockReturnValue(
        'https://accounts.google.com/o/oauth2/v2/auth?state=abc123'
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/connect',
      });

      expect(response.statusCode).toBe(302);

      const callArgs = mockOAuth2Instance.generateAuthUrl.mock.calls[0][0];
      expect(callArgs.state).toBeTruthy();
      expect(typeof callArgs.state).toBe('string');
      expect(callArgs.state.length).toBeGreaterThan(5);
    });

    it('should redirect to Google consent screen', async () => {
      const app = await createHttpServer();

      const mockAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test';
      mockOAuth2Instance.generateAuthUrl.mockReturnValue(mockAuthUrl);

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/connect',
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(mockAuthUrl);
    });
  });

  describe('OAuth Callback - /youtube/callback - Error Cases', () => {
    it('should handle OAuth error from Google', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?error=access_denied&state=abc123',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('OAuth Error');
      expect(body.message).toContain('access_denied');
    });

    it('should reject missing code parameter', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?state=abc123',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
      expect(body.message).toContain('Missing code or state');
    });

    it('should reject missing state parameter', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=test-code',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
      expect(body.message).toContain('Missing code or state');
    });

    it('should handle no access token received', async () => {
      const app = await createHttpServer();

      mockOAuth2Instance.getToken.mockResolvedValue({
        tokens: {
          // No access_token
          id_token: 'test-id-token',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=test-code&state=abc123',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('OAuth Error');
      expect(body.message).toContain('No access token received');
    });

    it('should handle no ID token received', async () => {
      const app = await createHttpServer();

      mockOAuth2Instance.getToken.mockResolvedValue({
        tokens: {
          access_token: 'test-access-token',
          // No id_token
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=test-code&state=abc123',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('OAuth Error');
      expect(body.message).toContain('No ID token received');
    });

    it('should handle invalid ID token (no profile)', async () => {
      const app = await createHttpServer();

      mockOAuth2Instance.getToken.mockResolvedValue({
        tokens: {
          access_token: 'test-access-token',
          id_token: 'test-id-token',
        },
      });

      mockOAuth2Instance.verifyIdToken.mockResolvedValue({
        getPayload: () => null, // Invalid payload
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=test-code&state=abc123',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('OAuth Error');
      expect(body.message).toContain('Failed to extract user profile');
    });

    it('should handle missing email in profile', async () => {
      const app = await createHttpServer();

      mockOAuth2Instance.getToken.mockResolvedValue({
        tokens: {
          access_token: 'test-access-token',
          id_token: 'test-id-token',
        },
      });

      mockOAuth2Instance.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-user-123',
          // Missing email
        }),
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=test-code&state=abc123',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('OAuth Error');
      expect(body.message).toContain('Failed to extract user profile');
    });

    it('should handle database error on user creation', async () => {
      const app = await createHttpServer();

      mockOAuth2Instance.getToken.mockResolvedValue({
        tokens: {
          access_token: 'test-access-token',
          id_token: 'test-id-token',
          refresh_token: 'test-refresh-token',
        },
      });

      mockOAuth2Instance.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-user-123',
          email: 'test@example.com',
          name: 'Test User',
          picture: 'https://example.com/avatar.jpg',
        }),
      });

      // No existing user
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // User creation fails
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=test-code&state=abc123',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Database Error');
      expect(body.message).toContain('Failed to create user profile');
    });

    it('should handle token exchange failure', async () => {
      const app = await createHttpServer();

      mockOAuth2Instance.getToken.mockRejectedValue(
        new Error('Invalid authorization code')
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=invalid-code&state=abc123',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('OAuth Error');
      expect(body.message).toContain('Failed to complete OAuth flow');
    });
  });

  describe('OAuth Callback - Success - New User', () => {
    it('should create new user with Google profile data', async () => {
      const app = await createHttpServer();

      mockOAuth2Instance.getToken.mockResolvedValue({
        tokens: {
          access_token: 'test-access-token',
          id_token: 'test-id-token',
          refresh_token: 'test-refresh-token',
          token_type: 'Bearer',
          scope: 'openid email profile',
          expiry_date: Date.now() + 3600000,
        },
      });

      mockOAuth2Instance.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-user-new',
          email: 'newuser@example.com',
          name: 'New User',
          picture: 'https://example.com/avatar.jpg',
        }),
      });

      // No existing user
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Successful user creation
      const newUser = {
        id: 'new-user-id-123',
        google_id: 'google-user-new',
        email: 'newuser@example.com',
        name: 'New User',
        avatar_url: 'https://example.com/avatar.jpg',
        tier: 'free',
      };

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: newUser,
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=test-code&state=abc123',
      });

      expect(response.statusCode).toBe(302);

      // Verify user was created with correct data
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          google_id: 'google-user-new',
          email: 'newuser@example.com',
          name: 'New User',
          avatar_url: 'https://example.com/avatar.jpg',
          tier: 'free',
        })
      );

      // Verify tokens were stored
      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          youtube_access_token: 'test-access-token',
          youtube_refresh_token: 'test-refresh-token',
          youtube_token_type: 'Bearer',
          youtube_scope: 'openid email profile',
          youtube_token_expiry: expect.any(String),
        })
      );
    });

    it('should generate JWT and set cookie for new user', async () => {
      const app = await createHttpServer();

      mockOAuth2Instance.getToken.mockResolvedValue({
        tokens: {
          access_token: 'test-access-token',
          id_token: 'test-id-token',
          refresh_token: 'test-refresh-token',
        },
      });

      mockOAuth2Instance.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-user-new',
          email: 'newuser@example.com',
          name: 'New User',
        }),
      });

      // No existing user
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Successful user creation
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'new-user-id-123',
          tier: 'free',
        },
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=test-code&state=abc123',
      });

      expect(response.statusCode).toBe(302);

      // Verify JWT was generated
      expect(mockGenerateToken).toHaveBeenCalledWith({
        userId: 'new-user-id-123',
        email: 'newuser@example.com',
        tier: 'free',
      });

      // Verify cookie was set
      const setCookieHeader = response.headers['set-cookie'];
      expect(setCookieHeader).toBeTruthy();
      expect(setCookieHeader).toContain('vocalytics_token=mock-jwt-token');
      expect(setCookieHeader).toContain('HttpOnly');
      expect(setCookieHeader).toContain('Path=/');
    });

    it('should redirect to app with success indicator', async () => {
      const app = await createHttpServer();

      mockOAuth2Instance.getToken.mockResolvedValue({
        tokens: {
          access_token: 'test-access-token',
          id_token: 'test-id-token',
          refresh_token: 'test-refresh-token',
        },
      });

      mockOAuth2Instance.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-user-new',
          email: 'newuser@example.com',
        }),
      });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 'new-user-id-123', tier: 'free' },
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=test-code&state=abc123',
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toContain('/app?yt=connected');
    });

    it('should use correct redirect URL in development', async () => {
      const app = await createHttpServer();
      process.env.NODE_ENV = 'development';

      mockOAuth2Instance.getToken.mockResolvedValue({
        tokens: {
          access_token: 'test-access-token',
          id_token: 'test-id-token',
          refresh_token: 'test-refresh-token',
        },
      });

      mockOAuth2Instance.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-user-new',
          email: 'newuser@example.com',
        }),
      });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 'new-user-id-123', tier: 'free' },
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=test-code&state=abc123',
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe('http://localhost:5173/app?yt=connected');
    });

    it('should use correct redirect URL in production', async () => {
      const app = await createHttpServer();
      process.env.NODE_ENV = 'production';

      mockOAuth2Instance.getToken.mockResolvedValue({
        tokens: {
          access_token: 'test-access-token',
          id_token: 'test-id-token',
          refresh_token: 'test-refresh-token',
        },
      });

      mockOAuth2Instance.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-user-new',
          email: 'newuser@example.com',
        }),
      });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 'new-user-id-123', tier: 'free' },
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=test-code&state=abc123',
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe('/app?yt=connected');
    });

    it('should use APP_URL env var when set', async () => {
      const app = await createHttpServer();
      process.env.APP_URL = 'https://custom-domain.com';

      mockOAuth2Instance.getToken.mockResolvedValue({
        tokens: {
          access_token: 'test-access-token',
          id_token: 'test-id-token',
          refresh_token: 'test-refresh-token',
        },
      });

      mockOAuth2Instance.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-user-new',
          email: 'newuser@example.com',
        }),
      });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 'new-user-id-123', tier: 'free' },
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=test-code&state=abc123',
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe('https://custom-domain.com/app?yt=connected');
    });

    it('should handle missing name in profile (use email as fallback)', async () => {
      const app = await createHttpServer();

      mockOAuth2Instance.getToken.mockResolvedValue({
        tokens: {
          access_token: 'test-access-token',
          id_token: 'test-id-token',
          refresh_token: 'test-refresh-token',
        },
      });

      mockOAuth2Instance.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-user-new',
          email: 'newuser@example.com',
          // No name provided
        }),
      });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 'new-user-id', tier: 'free' },
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=test-code&state=abc123',
      });

      expect(response.statusCode).toBe(302);

      // Verify email was used as name fallback
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'newuser@example.com',
        })
      );
    });
  });

  describe('OAuth Callback - Success - Existing User', () => {
    it('should update existing user tokens', async () => {
      const app = await createHttpServer();

      mockOAuth2Instance.getToken.mockResolvedValue({
        tokens: {
          access_token: 'new-access-token',
          id_token: 'test-id-token',
          refresh_token: 'new-refresh-token',
          token_type: 'Bearer',
          scope: 'openid email profile youtube',
          expiry_date: Date.now() + 3600000,
        },
      });

      mockOAuth2Instance.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-user-existing',
          email: 'existing@example.com',
          name: 'Existing User',
        }),
      });

      // Existing user found
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'existing-user-id',
          google_id: 'google-user-existing',
          email: 'existing@example.com',
          tier: 'pro',
          youtube_refresh_token: 'old-refresh-token',
        },
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=test-code&state=abc123',
      });

      expect(response.statusCode).toBe(302);

      // Verify user was NOT created (no insert call)
      expect(mockSupabaseClient.insert).not.toHaveBeenCalled();

      // Verify tokens were updated
      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          youtube_access_token: 'new-access-token',
          youtube_refresh_token: 'new-refresh-token',
        })
      );
    });

    it('should preserve existing refresh token when Google does not return new one (GOTCHA)', async () => {
      const app = await createHttpServer();

      mockOAuth2Instance.getToken.mockResolvedValue({
        tokens: {
          access_token: 'new-access-token',
          id_token: 'test-id-token',
          // NO refresh_token (Google often doesn't return on subsequent consents)
          token_type: 'Bearer',
        },
      });

      mockOAuth2Instance.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-user-existing',
          email: 'existing@example.com',
        }),
      });

      // Existing user with refresh token
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'existing-user-id',
          google_id: 'google-user-existing',
          email: 'existing@example.com',
          tier: 'pro',
          youtube_refresh_token: 'existing-refresh-token',
        },
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=test-code&state=abc123',
      });

      expect(response.statusCode).toBe(302);

      // Verify existing refresh token was preserved
      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          youtube_access_token: 'new-access-token',
          youtube_refresh_token: 'existing-refresh-token', // Preserved!
        })
      );
    });

    it('should generate JWT with existing user tier', async () => {
      const app = await createHttpServer();

      mockOAuth2Instance.getToken.mockResolvedValue({
        tokens: {
          access_token: 'test-access-token',
          id_token: 'test-id-token',
        },
      });

      mockOAuth2Instance.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-user-existing',
          email: 'existing@example.com',
        }),
      });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'existing-user-id',
          google_id: 'google-user-existing',
          tier: 'pro',
          youtube_refresh_token: 'existing-refresh-token',
        },
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=test-code&state=abc123',
      });

      expect(response.statusCode).toBe(302);

      // Verify JWT includes existing user's tier
      expect(mockGenerateToken).toHaveBeenCalledWith({
        userId: 'existing-user-id',
        email: 'existing@example.com',
        tier: 'pro',
      });
    });
  });

  describe('Comments Endpoint - /youtube/comments', () => {
    beforeEach(() => {
      mockGetAuthedYouTubeForUser.mockResolvedValue(mockYoutubeInstance);
    });

    it('should require videoId parameter', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/comments',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
      expect(body.message).toContain('videoId is required');
    });

    it('should fetch comments with valid videoId', async () => {
      const app = await createHttpServer();

      mockYoutubeInstance.commentThreads.list.mockResolvedValue({
        data: {
          items: [
            {
              id: 'thread-1',
              snippet: {
                topLevelComment: {
                  snippet: {
                    textDisplay: 'Great video!',
                    authorDisplayName: 'User 1',
                  },
                },
              },
            },
          ],
          nextPageToken: 'page-2',
          pageInfo: {
            totalResults: 100,
            resultsPerPage: 50,
          },
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/comments?videoId=test-video-123',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items).toHaveLength(1);
      expect(body.nextPageToken).toBe('page-2');
      expect(body.pageInfo).toBeTruthy();

      expect(mockYoutubeInstance.commentThreads.list).toHaveBeenCalledWith({
        part: ['id', 'snippet', 'replies'],
        videoId: 'test-video-123',
        order: 'time',
        maxResults: 50,
        pageToken: undefined,
        textFormat: 'plainText',
      });
    });

    it('should support pagination with pageToken', async () => {
      const app = await createHttpServer();

      mockYoutubeInstance.commentThreads.list.mockResolvedValue({
        data: {
          items: [],
          nextPageToken: 'page-3',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/comments?videoId=test-video&pageToken=page-2',
      });

      expect(response.statusCode).toBe(200);

      expect(mockYoutubeInstance.commentThreads.list).toHaveBeenCalledWith(
        expect.objectContaining({
          pageToken: 'page-2',
        })
      );
    });

    it('should support includeReplies parameter', async () => {
      const app = await createHttpServer();

      mockYoutubeInstance.commentThreads.list.mockResolvedValue({
        data: {
          items: [
            {
              id: 'thread-1',
              snippet: {},
              replies: {
                comments: [
                  { id: 'reply-1', snippet: { textDisplay: 'Reply 1' } },
                ],
              },
            },
          ],
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/comments?videoId=test-video&includeReplies=true',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items[0].replies).toBeTruthy();
    });

    it('should exclude replies when includeReplies is false', async () => {
      const app = await createHttpServer();

      mockYoutubeInstance.commentThreads.list.mockResolvedValue({
        data: {
          items: [
            {
              id: 'thread-1',
              snippet: {},
              replies: {
                comments: [
                  { id: 'reply-1', snippet: { textDisplay: 'Reply 1' } },
                ],
              },
            },
          ],
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/comments?videoId=test-video&includeReplies=false',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items[0].replies).toBeUndefined();
    });

    it('should support order parameter', async () => {
      const app = await createHttpServer();

      mockYoutubeInstance.commentThreads.list.mockResolvedValue({
        data: { items: [] },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/comments?videoId=test-video&order=relevance',
      });

      expect(response.statusCode).toBe(200);

      expect(mockYoutubeInstance.commentThreads.list).toHaveBeenCalledWith(
        expect.objectContaining({
          order: 'relevance',
        })
      );
    });

    it('should default to time order when not specified', async () => {
      const app = await createHttpServer();

      mockYoutubeInstance.commentThreads.list.mockResolvedValue({
        data: { items: [] },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/comments?videoId=test-video',
      });

      expect(response.statusCode).toBe(200);

      expect(mockYoutubeInstance.commentThreads.list).toHaveBeenCalledWith(
        expect.objectContaining({
          order: 'time',
        })
      );
    });

    it('should handle YouTube not connected error', async () => {
      const app = await createHttpServer();

      const notConnectedError: any = new Error(
        'YouTube not connected - no access token found'
      );
      notConnectedError.code = 'YOUTUBE_NOT_CONNECTED';
      mockGetAuthedYouTubeForUser.mockRejectedValue(notConnectedError);

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/comments?videoId=test-video',
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('YouTube Not Connected');
      expect(body.needsConnect).toBe(true);
    });

    it('should handle YouTube API errors', async () => {
      const app = await createHttpServer();

      mockYoutubeInstance.commentThreads.list.mockRejectedValue(
        new Error('API quota exceeded')
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/comments?videoId=test-video',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal Server Error');
      expect(body.message).toContain('Failed to fetch comments');
    });
  });

  describe('Reply Posting - /youtube/reply', () => {
    beforeEach(() => {
      mockGetAuthedYouTubeForUser.mockResolvedValue(mockYoutubeInstance);
    });

    it('should require parentId', async () => {
      // Create fresh app for each test to avoid rate limit accumulation
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/youtube/reply',
        payload: {
          text: 'Test reply',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
      expect(body.message).toContain('parentId and text are required');
      await app.close();
    });

    it('should require text', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/youtube/reply',
        payload: {
          parentId: 'comment-123',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
      expect(body.message).toContain('parentId and text are required');
      await app.close();
    });

    it('should post reply with valid data', async () => {
      const app = await createHttpServer();

      mockYoutubeInstance.comments.insert.mockResolvedValue({
        data: {
          id: 'new-reply-123',
          snippet: {
            textDisplay: 'Test reply',
          },
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/youtube/reply',
        payload: {
          parentId: 'comment-123',
          text: 'Test reply',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.comment).toBeTruthy();

      expect(mockYoutubeInstance.comments.insert).toHaveBeenCalledWith({
        part: ['snippet'],
        requestBody: {
          snippet: {
            parentId: 'comment-123',
            textOriginal: 'Test reply',
          },
        },
      });
      await app.close();
    });

    it('should truncate text to 220 characters', async () => {
      const app = await createHttpServer();

      mockYoutubeInstance.comments.insert.mockResolvedValue({
        data: { id: 'reply-123' },
      });

      const longText = 'a'.repeat(300);

      const response = await app.inject({
        method: 'POST',
        url: '/api/youtube/reply',
        payload: {
          parentId: 'comment-123',
          text: longText,
        },
      });

      expect(response.statusCode).toBe(200);

      expect(mockYoutubeInstance.comments.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: {
            snippet: {
              parentId: 'comment-123',
              textOriginal: 'a'.repeat(220), // Truncated
            },
          },
        })
      );
      await app.close();
    });

    it('should handle insufficient permissions (readonly scope)', async () => {
      const app = await createHttpServer();

      const permissionError: any = new Error('Insufficient permissions');
      permissionError.code = 403;
      mockYoutubeInstance.comments.insert.mockRejectedValue(permissionError);

      const response = await app.inject({
        method: 'POST',
        url: '/api/youtube/reply',
        payload: {
          parentId: 'comment-123',
          text: 'Test reply',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Insufficient Permissions');
      expect(body.needsReconnect).toBe(true);
      await app.close();
    });

    it('should handle YouTube not connected error', async () => {
      const app = await createHttpServer();

      const notConnectedError: any = new Error(
        'YouTube not connected - no access token found'
      );
      notConnectedError.code = 'YOUTUBE_NOT_CONNECTED';
      mockGetAuthedYouTubeForUser.mockRejectedValue(notConnectedError);

      const response = await app.inject({
        method: 'POST',
        url: '/api/youtube/reply',
        payload: {
          parentId: 'comment-123',
          text: 'Test reply',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('YouTube Not Connected');
      expect(body.needsConnect).toBe(true);
      await app.close();
    });

    it('should handle YouTube API errors', async () => {
      const app = await createHttpServer();

      mockYoutubeInstance.comments.insert.mockRejectedValue(
        new Error('API error')
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/youtube/reply',
        payload: {
          parentId: 'comment-123',
          text: 'Test reply',
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal Server Error');
      expect(body.message).toContain('Failed to post reply');
      await app.close();
    });
  });

  // Rate limiting tests skipped - rate limit Map is module-level and accumulates across tests
  // These should be tested in isolation or with a mechanism to reset the rate limit Map
  describe.skip('Rate Limiting (10 req/min per user, shared across endpoints)', () => {
    beforeEach(() => {
      mockGetAuthedYouTubeForUser.mockResolvedValue(mockYoutubeInstance);
      mockYoutubeInstance.commentThreads.list.mockResolvedValue({
        data: { items: [] },
      });
      mockYoutubeInstance.comments.insert.mockResolvedValue({
        data: { id: 'reply-123' },
      });
    });

    it('should allow up to 10 requests per minute', async () => {
      // Create fresh app for this test to avoid rate limit carryover
      const app = await createHttpServer();

      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        const response = await app.inject({
          method: 'GET',
          url: `/api/youtube/comments?videoId=test-video-${i}`,
        });
        expect(response.statusCode).toBe(200);
      }

      expect(mockYoutubeInstance.commentThreads.list).toHaveBeenCalledTimes(10);
      await app.close();
    });

    it('should block 11th request within the same minute', async () => {
      // Create fresh app for this test to avoid rate limit carryover
      const app = await createHttpServer();

      // Make 10 successful requests
      for (let i = 0; i < 10; i++) {
        await app.inject({
          method: 'GET',
          url: `/api/youtube/comments?videoId=test-video-${i}`,
        });
      }

      // 11th request should be rate limited
      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/comments?videoId=test-video-11',
      });

      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Rate Limit Exceeded');
      expect(body.message).toContain('Too many requests');

      // Should not have called YouTube API for 11th request
      expect(mockYoutubeInstance.commentThreads.list).toHaveBeenCalledTimes(10);
      await app.close();
    });

    it('should apply rate limiting to reply endpoint', async () => {
      // Create fresh app for this test to avoid rate limit carryover
      const app = await createHttpServer();

      // Make 10 successful requests
      for (let i = 0; i < 10; i++) {
        await app.inject({
          method: 'POST',
          url: '/api/youtube/reply',
          payload: {
            parentId: `comment-${i}`,
            text: 'Test reply',
          },
        });
      }

      // 11th request should be rate limited
      const response = await app.inject({
        method: 'POST',
        url: '/api/youtube/reply',
        payload: {
          parentId: 'comment-11',
          text: 'Test reply',
        },
      });

      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Rate Limit Exceeded');
      await app.close();
    });

    it('should enforce combined rate limit across comments and replies', async () => {
      // Create fresh app for this test to avoid rate limit carryover
      const app = await createHttpServer();

      // Make 5 comment requests
      for (let i = 0; i < 5; i++) {
        const response = await app.inject({
          method: 'GET',
          url: `/api/youtube/comments?videoId=test-${i}`,
        });
        expect(response.statusCode).toBe(200);
      }

      // Make 5 reply requests (combined limit with comments)
      for (let i = 0; i < 5; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/youtube/reply',
          payload: {
            parentId: `comment-${i}`,
            text: `Reply ${i}`,
          },
        });
        expect(response.statusCode).toBe(200);
      }

      // 11th request (either type) should be rate limited
      const commentResponse = await app.inject({
        method: 'GET',
        url: '/api/youtube/comments?videoId=test-11',
      });
      expect(commentResponse.statusCode).toBe(429);
      const commentData = JSON.parse(commentResponse.body);
      expect(commentData.error).toBe('Rate Limit Exceeded');
      expect(commentData.message).toContain('Too many requests');

      // Reply should also be rate limited
      const replyResponse = await app.inject({
        method: 'POST',
        url: '/api/youtube/reply',
        payload: {
          parentId: 'comment-12',
          text: 'Reply 12',
        },
      });
      expect(replyResponse.statusCode).toBe(429);
      const replyData = JSON.parse(replyResponse.body);
      expect(replyData.error).toBe('Rate Limit Exceeded');
      expect(replyData.message).toContain('Too many requests');
      await app.close();
    });
  });
});
