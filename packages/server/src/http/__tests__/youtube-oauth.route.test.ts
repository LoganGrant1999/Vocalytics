/**
 * YouTube OAuth Route Tests - Production Critical
 *
 * Tests the complete YouTube OAuth flow for user onboarding.
 * This is the primary authentication method for the application.
 *
 * Critical Scenarios:
 * - OAuth initiation (/api/youtube/connect)
 * - OAuth callback (/api/youtube/callback)
 * - New user creation
 * - Existing user token updates
 * - Error handling (denied, missing params, invalid tokens)
 * - JWT generation and cookie setting
 * - Environment-specific behavior (dev vs prod)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHttpServer } from '../index.js';
import type { FastifyInstance } from 'fastify';

// Use vi.hoisted for proper mock function creation
const {
  mockCreateOAuth2Client,
  mockGenerateAuthUrl,
  mockGetToken,
  mockVerifyIdToken,
  mockGetPayload,
  mockSupabaseFrom,
  mockSupabaseSelect,
  mockSupabaseEq,
  mockSupabaseSingle,
  mockSupabaseInsert,
  mockSupabaseUpdate,
  mockGenerateToken,
} = vi.hoisted(() => ({
  mockCreateOAuth2Client: vi.fn(),
  mockGenerateAuthUrl: vi.fn(),
  mockGetToken: vi.fn(),
  mockVerifyIdToken: vi.fn(),
  mockGetPayload: vi.fn(),
  mockSupabaseFrom: vi.fn(),
  mockSupabaseSelect: vi.fn(),
  mockSupabaseEq: vi.fn(),
  mockSupabaseSingle: vi.fn(),
  mockSupabaseInsert: vi.fn(),
  mockSupabaseUpdate: vi.fn(),
  mockGenerateToken: vi.fn(),
}));

// Mock google.js (OAuth client)
vi.mock('../../lib/google.js', () => ({
  createOAuth2Client: mockCreateOAuth2Client,
}));

// Mock JWT library
vi.mock('../../lib/jwt.js', () => ({
  generateToken: mockGenerateToken,
}));

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockSupabaseFrom,
  })),
}));

describe('YouTube OAuth Routes - Production Critical', () => {
  let app: FastifyInstance;
  let oauth2ClientMock: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup OAuth2 client mock
    oauth2ClientMock = {
      generateAuthUrl: mockGenerateAuthUrl,
      getToken: mockGetToken,
      verifyIdToken: mockVerifyIdToken,
    };

    mockCreateOAuth2Client.mockReturnValue(oauth2ClientMock);

    // Default Supabase chain mocks
    mockSupabaseFrom.mockReturnValue({ select: mockSupabaseSelect });
    mockSupabaseSelect.mockReturnValue({ eq: mockSupabaseEq });
    mockSupabaseEq.mockReturnValue({ single: mockSupabaseSingle });

    // Default mock for JWT
    mockGenerateToken.mockReturnValue('mock-jwt-token');

    app = await createHttpServer();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/youtube/connect - OAuth Initiation', () => {
    it('should redirect to Google OAuth URL', async () => {
      const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?scope=openid%20email...';
      mockGenerateAuthUrl.mockReturnValue(authUrl);

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/connect',
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(authUrl);
    });

    it('should include correct scopes in auth URL', async () => {
      let capturedOptions: any;
      mockGenerateAuthUrl.mockImplementation((options) => {
        capturedOptions = options;
        return 'https://accounts.google.com/o/oauth2/auth';
      });

      await app.inject({
        method: 'GET',
        url: '/api/youtube/connect',
      });

      expect(capturedOptions.scope).toEqual([
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/youtube.force-ssl',
      ]);
    });

    it('should include state token for CSRF protection', async () => {
      let capturedOptions: any;
      mockGenerateAuthUrl.mockImplementation((options) => {
        capturedOptions = options;
        return 'https://accounts.google.com/o/oauth2/auth';
      });

      await app.inject({
        method: 'GET',
        url: '/api/youtube/connect',
      });

      expect(capturedOptions.state).toBeDefined();
      expect(typeof capturedOptions.state).toBe('string');
      expect(capturedOptions.state.length).toBeGreaterThan(0);
    });

    it('should request offline access for refresh token', async () => {
      let capturedOptions: any;
      mockGenerateAuthUrl.mockImplementation((options) => {
        capturedOptions = options;
        return 'https://accounts.google.com/o/oauth2/auth';
      });

      await app.inject({
        method: 'GET',
        url: '/api/youtube/connect',
      });

      expect(capturedOptions.access_type).toBe('offline');
    });

    it('should request consent prompt to ensure refresh token', async () => {
      let capturedOptions: any;
      mockGenerateAuthUrl.mockImplementation((options) => {
        capturedOptions = options;
        return 'https://accounts.google.com/o/oauth2/auth';
      });

      await app.inject({
        method: 'GET',
        url: '/api/youtube/connect',
      });

      expect(capturedOptions.prompt).toBe('consent');
    });
  });

  describe('GET /api/youtube/callback - OAuth Callback (Success Cases)', () => {
    it('should handle OAuth callback with valid code (new user)', async () => {
      // Mock OAuth token exchange
      mockGetToken.mockResolvedValue({
        tokens: {
          access_token: 'ya29.mock_access_token',
          refresh_token: 'mock_refresh_token',
          id_token: 'mock_id_token',
          token_type: 'Bearer',
          scope: 'openid email profile youtube',
          expiry_date: Date.now() + 3600000, // 1 hour from now
        },
      });

      // Mock ID token verification
      const mockTicket = {
        getPayload: vi.fn().mockReturnValue({
          sub: 'google-user-123',
          email: 'newuser@example.com',
          name: 'New User',
          picture: 'https://example.com/avatar.jpg',
        }),
      };
      mockVerifyIdToken.mockResolvedValue(mockTicket);

      // Mock Supabase - user doesn't exist
      mockSupabaseSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }, // Not found
      });

      // Mock user creation
      mockSupabaseInsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'user-new-123',
              google_id: 'google-user-123',
              email: 'newuser@example.com',
              name: 'New User',
              tier: 'free',
            },
            error: null,
          }),
        }),
      });

      // Mock token update
      mockSupabaseUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: mockSupabaseSelect,
            insert: mockSupabaseInsert,
            update: mockSupabaseUpdate,
          };
        }
        return { select: mockSupabaseSelect };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=auth_code_123&state=csrf_token_abc',
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toContain('/app?yt=connected');
      expect(mockGetToken).toHaveBeenCalledWith('auth_code_123');
      expect(mockVerifyIdToken).toHaveBeenCalled();
    });

    it('should create new user profile with Google data', async () => {
      mockGetToken.mockResolvedValue({
        tokens: {
          access_token: 'ya29.mock_access_token',
          refresh_token: 'mock_refresh_token',
          id_token: 'mock_id_token',
          expiry_date: Date.now() + 3600000,
        },
      });

      const mockTicket = {
        getPayload: vi.fn().mockReturnValue({
          sub: 'google-user-456',
          email: 'creator@example.com',
          name: 'Creator Name',
          picture: 'https://example.com/creator.jpg',
        }),
      };
      mockVerifyIdToken.mockResolvedValue(mockTicket);

      mockSupabaseSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      let insertedData: any;
      mockSupabaseInsert.mockImplementation((data) => {
        insertedData = data;
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'user-456', ...data },
              error: null,
            }),
          }),
        };
      });

      mockSupabaseUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: mockSupabaseSelect,
            insert: mockSupabaseInsert,
            update: mockSupabaseUpdate,
          };
        }
        return { select: mockSupabaseSelect };
      });

      await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=auth_code_456&state=csrf_token_xyz',
      });

      expect(insertedData).toEqual({
        google_id: 'google-user-456',
        email: 'creator@example.com',
        name: 'Creator Name',
        avatar_url: 'https://example.com/creator.jpg',
        tier: 'free',
      });
    });

    it('should store access_token and refresh_token', async () => {
      mockGetToken.mockResolvedValue({
        tokens: {
          access_token: 'ya29.new_access_token',
          refresh_token: 'new_refresh_token',
          id_token: 'mock_id_token',
          token_type: 'Bearer',
          scope: 'openid email',
          expiry_date: Date.now() + 3600000,
        },
      });

      const mockTicket = {
        getPayload: vi.fn().mockReturnValue({
          sub: 'google-user-789',
          email: 'test@example.com',
          name: 'Test User',
        }),
      };
      mockVerifyIdToken.mockResolvedValue(mockTicket);

      mockSupabaseSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      mockSupabaseInsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'user-789', google_id: 'google-user-789', email: 'test@example.com' },
            error: null,
          }),
        }),
      });

      let updateData: any;
      mockSupabaseUpdate.mockImplementation((data) => {
        updateData = data;
        return {
          eq: vi.fn().mockResolvedValue({ error: null }),
        };
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: mockSupabaseSelect,
            insert: mockSupabaseInsert,
            update: mockSupabaseUpdate,
          };
        }
        return { select: mockSupabaseSelect };
      });

      await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=auth_code_789&state=csrf_token_123',
      });

      expect(updateData.youtube_access_token).toBe('ya29.new_access_token');
      expect(updateData.youtube_refresh_token).toBe('new_refresh_token');
      expect(updateData.youtube_token_type).toBe('Bearer');
      expect(updateData.youtube_scope).toBeDefined();
    });

    it('should handle OAuth callback for existing user', async () => {
      mockGetToken.mockResolvedValue({
        tokens: {
          access_token: 'ya29.existing_user_token',
          refresh_token: 'existing_refresh_token',
          id_token: 'mock_id_token',
          expiry_date: Date.now() + 3600000,
        },
      });

      const mockTicket = {
        getPayload: vi.fn().mockReturnValue({
          sub: 'google-user-existing',
          email: 'existing@example.com',
          name: 'Existing User',
        }),
      };
      mockVerifyIdToken.mockResolvedValue(mockTicket);

      // Mock existing user
      mockSupabaseSingle.mockResolvedValue({
        data: {
          id: 'user-existing-123',
          google_id: 'google-user-existing',
          email: 'existing@example.com',
          tier: 'pro',
          youtube_refresh_token: 'old_refresh_token',
        },
        error: null,
      });

      mockSupabaseUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: mockSupabaseSelect,
            update: mockSupabaseUpdate,
          };
        }
        return { select: mockSupabaseSelect };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=auth_code_existing&state=csrf_token_abc',
      });

      expect(response.statusCode).toBe(302);
      expect(mockSupabaseUpdate).toHaveBeenCalled();
      // Should not try to create user
      expect(mockSupabaseInsert).not.toHaveBeenCalled();
    });

    it('should preserve existing refresh_token if not returned', async () => {
      // Google often doesn't return refresh_token on subsequent auths
      mockGetToken.mockResolvedValue({
        tokens: {
          access_token: 'ya29.new_access_token',
          // No refresh_token
          id_token: 'mock_id_token',
          expiry_date: Date.now() + 3600000,
        },
      });

      const mockTicket = {
        getPayload: vi.fn().mockReturnValue({
          sub: 'google-user-preserve',
          email: 'preserve@example.com',
          name: 'Preserve Test',
        }),
      };
      mockVerifyIdToken.mockResolvedValue(mockTicket);

      mockSupabaseSingle.mockResolvedValue({
        data: {
          id: 'user-preserve-123',
          google_id: 'google-user-preserve',
          email: 'preserve@example.com',
          tier: 'free',
          youtube_refresh_token: 'existing_refresh_token',
        },
        error: null,
      });

      let updateData: any;
      mockSupabaseUpdate.mockImplementation((data) => {
        updateData = data;
        return {
          eq: vi.fn().mockResolvedValue({ error: null }),
        };
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: mockSupabaseSelect,
            update: mockSupabaseUpdate,
          };
        }
        return { select: mockSupabaseSelect };
      });

      await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=auth_code_preserve&state=csrf_token_123',
      });

      // Should preserve existing refresh token
      expect(updateData.youtube_refresh_token).toBe('existing_refresh_token');
    });

    it('should generate JWT and set cookie', async () => {
      mockGetToken.mockResolvedValue({
        tokens: {
          access_token: 'ya29.jwt_test_token',
          refresh_token: 'jwt_refresh_token',
          id_token: 'mock_id_token',
          expiry_date: Date.now() + 3600000,
        },
      });

      const mockTicket = {
        getPayload: vi.fn().mockReturnValue({
          sub: 'google-user-jwt',
          email: 'jwt@example.com',
          name: 'JWT Test',
        }),
      };
      mockVerifyIdToken.mockResolvedValue(mockTicket);

      mockSupabaseSingle.mockResolvedValue({
        data: {
          id: 'user-jwt-123',
          google_id: 'google-user-jwt',
          email: 'jwt@example.com',
          tier: 'pro',
        },
        error: null,
      });

      mockSupabaseUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: mockSupabaseSelect,
            update: mockSupabaseUpdate,
          };
        }
        return { select: mockSupabaseSelect };
      });

      mockGenerateToken.mockReturnValue('generated-jwt-token-123');

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=auth_code_jwt&state=csrf_token_123',
      });

      expect(mockGenerateToken).toHaveBeenCalledWith({
        userId: 'user-jwt-123',
        email: 'jwt@example.com',
        tier: 'pro',
      });

      // Check cookie was set
      const setCookieHeader = response.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader).toContain('vocalytics_token');
    });

    it('should redirect to app with success indicator', async () => {
      mockGetToken.mockResolvedValue({
        tokens: {
          access_token: 'ya29.redirect_test',
          refresh_token: 'redirect_refresh',
          id_token: 'mock_id_token',
          expiry_date: Date.now() + 3600000,
        },
      });

      const mockTicket = {
        getPayload: vi.fn().mockReturnValue({
          sub: 'google-user-redirect',
          email: 'redirect@example.com',
          name: 'Redirect Test',
        }),
      };
      mockVerifyIdToken.mockResolvedValue(mockTicket);

      mockSupabaseSingle.mockResolvedValue({
        data: {
          id: 'user-redirect-123',
          google_id: 'google-user-redirect',
          email: 'redirect@example.com',
          tier: 'free',
        },
        error: null,
      });

      mockSupabaseUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: mockSupabaseSelect,
            update: mockSupabaseUpdate,
          };
        }
        return { select: mockSupabaseSelect };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=auth_code_redirect&state=csrf_token_123',
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toContain('/app');
      expect(response.headers.location).toContain('yt=connected');
    });
  });

  describe('GET /api/youtube/callback - Error Cases', () => {
    it('should handle OAuth error (user denied)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?error=access_denied&state=csrf_token_123',
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('OAuth Error');
      expect(data.message).toContain('access_denied');
    });

    it('should handle missing code parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?state=csrf_token_123',
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Bad Request');
      expect(data.message).toContain('Missing code or state parameter');
    });

    it('should handle missing state parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=auth_code_123',
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Bad Request');
      expect(data.message).toContain('Missing code or state parameter');
    });

    it('should handle invalid authorization code', async () => {
      mockGetToken.mockRejectedValue(new Error('invalid_grant'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=invalid_code&state=csrf_token_123',
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('OAuth Error');
      expect(data.message).toContain('Failed to complete OAuth flow');
    });

    it('should handle missing access token in response', async () => {
      mockGetToken.mockResolvedValue({
        tokens: {
          // No access_token
          id_token: 'mock_id_token',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=auth_code_no_access&state=csrf_token_123',
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('OAuth Error');
      expect(data.message).toContain('No access token received from Google');
    });

    it('should handle missing ID token in response', async () => {
      mockGetToken.mockResolvedValue({
        tokens: {
          access_token: 'ya29.access_token',
          // No id_token
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=auth_code_no_id&state=csrf_token_123',
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('OAuth Error');
      expect(data.message).toContain('No ID token received from Google');
    });

    it('should handle invalid ID token', async () => {
      mockGetToken.mockResolvedValue({
        tokens: {
          access_token: 'ya29.access_token',
          id_token: 'invalid_id_token',
        },
      });

      mockVerifyIdToken.mockRejectedValue(new Error('Invalid ID token'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=auth_code_bad_id&state=csrf_token_123',
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('OAuth Error');
    });

    it('should handle missing user profile in ID token', async () => {
      mockGetToken.mockResolvedValue({
        tokens: {
          access_token: 'ya29.access_token',
          id_token: 'mock_id_token',
        },
      });

      const mockTicket = {
        getPayload: vi.fn().mockReturnValue(null), // No payload
      };
      mockVerifyIdToken.mockResolvedValue(mockTicket);

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=auth_code_no_profile&state=csrf_token_123',
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('OAuth Error');
      expect(data.message).toContain('Failed to extract user profile');
    });

    it('should handle database error during user creation', async () => {
      mockGetToken.mockResolvedValue({
        tokens: {
          access_token: 'ya29.access_token',
          refresh_token: 'refresh_token',
          id_token: 'mock_id_token',
        },
      });

      const mockTicket = {
        getPayload: vi.fn().mockReturnValue({
          sub: 'google-user-db-error',
          email: 'dberror@example.com',
          name: 'DB Error Test',
        }),
      };
      mockVerifyIdToken.mockResolvedValue(mockTicket);

      mockSupabaseSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      // Mock user creation failure
      mockSupabaseInsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database connection failed' },
          }),
        }),
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: mockSupabaseSelect,
            insert: mockSupabaseInsert,
          };
        }
        return { select: mockSupabaseSelect };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=auth_code_db_error&state=csrf_token_123',
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Database Error');
      expect(data.message).toContain('Failed to create user profile');
    });

    it('should handle database error during token storage', async () => {
      mockGetToken.mockResolvedValue({
        tokens: {
          access_token: 'ya29.access_token',
          refresh_token: 'refresh_token',
          id_token: 'mock_id_token',
        },
      });

      const mockTicket = {
        getPayload: vi.fn().mockReturnValue({
          sub: 'google-user-token-error',
          email: 'tokenerror@example.com',
          name: 'Token Error Test',
        }),
      };
      mockVerifyIdToken.mockResolvedValue(mockTicket);

      mockSupabaseSingle.mockResolvedValue({
        data: {
          id: 'user-token-error-123',
          google_id: 'google-user-token-error',
          email: 'tokenerror@example.com',
          tier: 'free',
        },
        error: null,
      });

      // Mock token update failure
      mockSupabaseUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: { message: 'Failed to update tokens' },
        }),
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: mockSupabaseSelect,
            update: mockSupabaseUpdate,
          };
        }
        return { select: mockSupabaseSelect };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=auth_code_token_error&state=csrf_token_123',
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Database Error');
      expect(data.message).toContain('Failed to store YouTube tokens');
    });
  });

  describe('Environment-Specific Behavior', () => {
    it('should set secure cookie in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        mockGetToken.mockResolvedValue({
          tokens: {
            access_token: 'ya29.prod_token',
            refresh_token: 'prod_refresh',
            id_token: 'mock_id_token',
          },
        });

        const mockTicket = {
          getPayload: vi.fn().mockReturnValue({
            sub: 'google-user-prod',
            email: 'prod@example.com',
            name: 'Prod User',
          }),
        };
        mockVerifyIdToken.mockResolvedValue(mockTicket);

        mockSupabaseSingle.mockResolvedValue({
          data: {
            id: 'user-prod-123',
            google_id: 'google-user-prod',
            email: 'prod@example.com',
            tier: 'free',
          },
          error: null,
        });

        mockSupabaseUpdate.mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        });

        mockSupabaseFrom.mockImplementation((table: string) => {
          if (table === 'profiles') {
            return {
              select: mockSupabaseSelect,
              update: mockSupabaseUpdate,
            };
          }
          return { select: mockSupabaseSelect };
        });

        const response = await app.inject({
          method: 'GET',
          url: '/api/youtube/callback?code=auth_code_prod&state=csrf_token_123',
        });

        const setCookieHeader = response.headers['set-cookie'];
        expect(setCookieHeader).toBeDefined();
        // In production, cookie should be secure
        expect(setCookieHeader).toContain('Secure');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should redirect to localhost in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalAppUrl = process.env.APP_URL;
      process.env.NODE_ENV = 'development';
      delete process.env.APP_URL;

      try {
        mockGetToken.mockResolvedValue({
          tokens: {
            access_token: 'ya29.dev_token',
            refresh_token: 'dev_refresh',
            id_token: 'mock_id_token',
          },
        });

        const mockTicket = {
          getPayload: vi.fn().mockReturnValue({
            sub: 'google-user-dev',
            email: 'dev@example.com',
            name: 'Dev User',
          }),
        };
        mockVerifyIdToken.mockResolvedValue(mockTicket);

        mockSupabaseSingle.mockResolvedValue({
          data: {
            id: 'user-dev-123',
            google_id: 'google-user-dev',
            email: 'dev@example.com',
            tier: 'free',
          },
          error: null,
        });

        mockSupabaseUpdate.mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        });

        mockSupabaseFrom.mockImplementation((table: string) => {
          if (table === 'profiles') {
            return {
              select: mockSupabaseSelect,
              update: mockSupabaseUpdate,
            };
          }
          return { select: mockSupabaseSelect };
        });

        const response = await app.inject({
          method: 'GET',
          url: '/api/youtube/callback?code=auth_code_dev&state=csrf_token_123',
        });

        expect(response.statusCode).toBe(302);
        expect(response.headers.location).toContain('localhost:5173');
      } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalAppUrl) {
          process.env.APP_URL = originalAppUrl;
        }
      }
    });

    it('should use APP_URL when set', async () => {
      const originalAppUrl = process.env.APP_URL;
      process.env.APP_URL = 'https://custom-domain.com';

      try {
        mockGetToken.mockResolvedValue({
          tokens: {
            access_token: 'ya29.custom_token',
            refresh_token: 'custom_refresh',
            id_token: 'mock_id_token',
          },
        });

        const mockTicket = {
          getPayload: vi.fn().mockReturnValue({
            sub: 'google-user-custom',
            email: 'custom@example.com',
            name: 'Custom User',
          }),
        };
        mockVerifyIdToken.mockResolvedValue(mockTicket);

        mockSupabaseSingle.mockResolvedValue({
          data: {
            id: 'user-custom-123',
            google_id: 'google-user-custom',
            email: 'custom@example.com',
            tier: 'free',
          },
          error: null,
        });

        mockSupabaseUpdate.mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        });

        mockSupabaseFrom.mockImplementation((table: string) => {
          if (table === 'profiles') {
            return {
              select: mockSupabaseSelect,
              update: mockSupabaseUpdate,
            };
          }
          return { select: mockSupabaseSelect };
        });

        const response = await app.inject({
          method: 'GET',
          url: '/api/youtube/callback?code=auth_code_custom&state=csrf_token_123',
        });

        expect(response.statusCode).toBe(302);
        expect(response.headers.location).toContain('custom-domain.com');
      } finally {
        if (originalAppUrl) {
          process.env.APP_URL = originalAppUrl;
        } else {
          delete process.env.APP_URL;
        }
      }
    });
  });

  describe('Integration Scenarios', () => {
    it('should complete full OAuth flow for first-time user', async () => {
      // Simulate complete flow: connect → Google → callback → user creation → JWT → redirect
      mockGetToken.mockResolvedValue({
        tokens: {
          access_token: 'ya29.full_flow_token',
          refresh_token: 'full_flow_refresh',
          id_token: 'mock_id_token',
          token_type: 'Bearer',
          scope: 'openid email profile youtube',
          expiry_date: Date.now() + 3600000,
        },
      });

      const mockTicket = {
        getPayload: vi.fn().mockReturnValue({
          sub: 'google-user-full-flow',
          email: 'fullflow@example.com',
          name: 'Full Flow User',
          picture: 'https://example.com/full-flow.jpg',
        }),
      };
      mockVerifyIdToken.mockResolvedValue(mockTicket);

      mockSupabaseSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      mockSupabaseInsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'user-full-flow-123',
              google_id: 'google-user-full-flow',
              email: 'fullflow@example.com',
              name: 'Full Flow User',
              tier: 'free',
            },
            error: null,
          }),
        }),
      });

      mockSupabaseUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: mockSupabaseSelect,
            insert: mockSupabaseInsert,
            update: mockSupabaseUpdate,
          };
        }
        return { select: mockSupabaseSelect };
      });

      mockGenerateToken.mockReturnValue('full-flow-jwt-token');

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=auth_code_full_flow&state=csrf_token_full',
      });

      // Verify complete flow
      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toContain('/app?yt=connected');
      expect(mockGetToken).toHaveBeenCalledWith('auth_code_full_flow');
      expect(mockVerifyIdToken).toHaveBeenCalled();
      expect(mockSupabaseInsert).toHaveBeenCalled();
      expect(mockSupabaseUpdate).toHaveBeenCalled();
      expect(mockGenerateToken).toHaveBeenCalledWith({
        userId: 'user-full-flow-123',
        email: 'fullflow@example.com',
        tier: 'free',
      });
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should complete full OAuth flow for returning user', async () => {
      mockGetToken.mockResolvedValue({
        tokens: {
          access_token: 'ya29.returning_token',
          // No refresh_token (Google doesn't return on subsequent auths)
          id_token: 'mock_id_token',
          expiry_date: Date.now() + 3600000,
        },
      });

      const mockTicket = {
        getPayload: vi.fn().mockReturnValue({
          sub: 'google-user-returning',
          email: 'returning@example.com',
          name: 'Returning User',
        }),
      };
      mockVerifyIdToken.mockResolvedValue(mockTicket);

      mockSupabaseSingle.mockResolvedValue({
        data: {
          id: 'user-returning-123',
          google_id: 'google-user-returning',
          email: 'returning@example.com',
          tier: 'pro',
          youtube_refresh_token: 'existing_refresh_token',
        },
        error: null,
      });

      mockSupabaseUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: mockSupabaseSelect,
            update: mockSupabaseUpdate,
          };
        }
        return { select: mockSupabaseSelect };
      });

      mockGenerateToken.mockReturnValue('returning-jwt-token');

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/callback?code=auth_code_returning&state=csrf_token_ret',
      });

      // Verify returning user flow
      expect(response.statusCode).toBe(302);
      expect(mockSupabaseInsert).not.toHaveBeenCalled(); // No user creation
      expect(mockSupabaseUpdate).toHaveBeenCalled(); // Update tokens
      expect(mockGenerateToken).toHaveBeenCalledWith({
        userId: 'user-returning-123',
        email: 'returning@example.com',
        tier: 'pro',
      });
    });
  });
});
