import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeVerifyToken } from './testAuth';

// Mock auth BEFORE importing anything else - use fastify-plugin wrapper
vi.mock('../auth.js', async () => {
  const fp = await import('fastify-plugin');
  const plugin = (app: any, opts: any, done: any) => {
    app.addHook('preHandler', fakeVerifyToken);
    done();
  };
  return {
    default: fp.default(plugin, { name: 'auth-plugin' })
  };
});

// Mock the google lib
vi.mock('../../lib/google.js', () => ({
  getUploadsPlaylistId: vi.fn(),
  listPlaylistVideos: vi.fn(),
  getVideoStats: vi.fn(),
  getAuthedYouTubeForUser: vi.fn(),
  createOAuth2Client: vi.fn(),
  getRedirectUri: vi.fn(() => 'http://localhost:3000/api/youtube/callback'),
}));

// Mock the database
vi.mock('../../db/videos.js', () => ({
  upsertUserVideos: vi.fn(),
  getUserVideos: vi.fn(),
  getUserVideo: vi.fn(),
}));

// Mock Supabase client creation
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: {
              id: 'test-user-id',
              email: 'test@example.com',
              tier: 'free',
            },
            error: null,
          })),
        })),
        limit: vi.fn(() => ({ error: null })),
      })),
    })),
  })),
}));

import { createHttpServer } from '../index.js';
import * as googleLib from '../../lib/google.js';
import * as videosDb from '../../db/videos.js';

describe('GET /api/youtube/videos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return list of videos with stats', async () => {
    const app = await createHttpServer();

    // Mock data
    const mockVideos = [
      {
        videoId: 'vid1',
        title: 'Test Video 1',
        thumbnailUrl: 'https://i.ytimg.com/vi/vid1/default.jpg',
        publishedAt: '2025-01-01T00:00:00Z',
      },
      {
        videoId: 'vid2',
        title: 'Test Video 2',
        thumbnailUrl: 'https://i.ytimg.com/vi/vid2/default.jpg',
        publishedAt: '2025-01-02T00:00:00Z',
      },
      {
        videoId: 'vid3',
        title: 'Test Video 3',
        thumbnailUrl: 'https://i.ytimg.com/vi/vid3/default.jpg',
        publishedAt: '2025-01-03T00:00:00Z',
      },
    ];

    const mockStats = {
      vid1: { viewCount: 1000, likeCount: 100, commentCount: 10 },
      vid2: { viewCount: 2000, likeCount: 200, commentCount: 20 },
      vid3: { viewCount: 3000, likeCount: 300, commentCount: 30 },
    };

    // Setup mocks
    vi.mocked(googleLib.getUploadsPlaylistId).mockResolvedValue('UU123');
    vi.mocked(googleLib.listPlaylistVideos).mockResolvedValue(mockVideos);
    vi.mocked(googleLib.getVideoStats).mockResolvedValue(mockStats);
    vi.mocked(videosDb.upsertUserVideos).mockResolvedValue(undefined);

    const response = await app.inject({
      method: 'GET',
      url: '/api/youtube/videos?mine=true&limit=20',
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data).toHaveLength(3);
    expect(data[0].videoId).toBe('vid1');
    expect(data[0].title).toBe('Test Video 1');
    expect(data[0].stats.viewCount).toBe(1000);
    expect(data[1].videoId).toBe('vid2');
    expect(data[2].videoId).toBe('vid3');

    // Verify mocks were called
    expect(googleLib.getUploadsPlaylistId).toHaveBeenCalled();
    expect(googleLib.listPlaylistVideos).toHaveBeenCalled();
    expect(googleLib.getVideoStats).toHaveBeenCalled();
    expect(videosDb.upsertUserVideos).toHaveBeenCalled();
  });

  it('should return 403 if YouTube not connected', async () => {
    const app = await createHttpServer();

    // Mock YouTube not connected error
    vi.mocked(googleLib.getUploadsPlaylistId).mockRejectedValue(
      new Error('YouTube not connected')
    );

    const response = await app.inject({
      method: 'GET',
      url: '/api/youtube/videos?mine=true',
    });

    expect(response.statusCode).toBe(403);
    const data = JSON.parse(response.body);
    expect(data.error).toBe('YouTube not connected');
  });

  it('should respect limit parameter', async () => {
    const app = await createHttpServer();

    vi.mocked(googleLib.getUploadsPlaylistId).mockResolvedValue('UU123');
    vi.mocked(googleLib.listPlaylistVideos).mockResolvedValue([]);
    vi.mocked(googleLib.getVideoStats).mockResolvedValue({});
    vi.mocked(videosDb.upsertUserVideos).mockResolvedValue(undefined);

    await app.inject({
      method: 'GET',
      url: '/api/youtube/videos?mine=true&limit=10',
    });

    expect(googleLib.listPlaylistVideos).toHaveBeenCalled();
  });
});
