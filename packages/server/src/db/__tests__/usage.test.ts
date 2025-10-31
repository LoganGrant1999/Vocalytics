import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  recordUsage,
  tryConsumeAnalyze,
  tryConsumeReply,
  incrementUsage
} from '../usage.js';

// Mock the Supabase client
vi.mock('../client.js', () => {
  const mockSupabase = {
    from: vi.fn(),
    rpc: vi.fn(),
  };

  return {
    supabase: mockSupabase,
  };
});

import { supabase } from '../client.js';

describe('usage.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordUsage', () => {
    it('should insert usage event without metadata', async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockReturnValue({
        insert: insertMock,
      } as any);

      await recordUsage({
        userId: 'user-123',
        action: 'analyze',
        count: 5,
      });

      expect(insertMock).toHaveBeenCalledWith({
        user_id: 'user-123',
        action: 'analyze',
        count: 5,
        metadata: null,
      });
    });

    it('should insert usage event with metadata', async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockReturnValue({
        insert: insertMock,
      } as any);

      await recordUsage({
        userId: 'user-123',
        action: 'reply',
        count: 3,
        metadata: { videoId: 'abc123' },
      });

      expect(insertMock).toHaveBeenCalledWith({
        user_id: 'user-123',
        action: 'reply',
        count: 3,
        metadata: { videoId: 'abc123' },
      });
    });

    it('should throw on database error', async () => {
      const insertMock = vi.fn().mockResolvedValue({
        error: { message: 'Database error' }
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: insertMock,
      } as any);

      await expect(recordUsage({
        userId: 'user-123',
        action: 'analyze',
        count: 1,
      })).rejects.toThrow();
    });
  });

  describe('tryConsumeAnalyze', () => {
    it('should return allowed true when quota is available', async () => {
      const rpcMock = vi.fn().mockResolvedValue({
        data: [{ allowed: true, new_count: 1 }],
        error: null,
      });

      vi.mocked(supabase.rpc).mockImplementation(rpcMock);

      const result = await tryConsumeAnalyze({
        userDbId: 'user-123',
        cap: 10,
        incrementBy: 1,
      });

      expect(result).toEqual({ allowed: true, newCount: 1 });
      expect(rpcMock).toHaveBeenCalledWith('consume_analyze_quota', {
        _user_id: 'user-123',
        _cap: 10,
      });
    });

    it('should return allowed false when quota is exceeded', async () => {
      const rpcMock = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      vi.mocked(supabase.rpc).mockImplementation(rpcMock);

      const result = await tryConsumeAnalyze({
        userDbId: 'user-123',
        cap: 10,
        incrementBy: 1,
      });

      expect(result).toEqual({ allowed: false });
    });

    it('should throw when incrementBy is not 1', async () => {
      await expect(tryConsumeAnalyze({
        userDbId: 'user-123',
        cap: 10,
        incrementBy: 5,
      })).rejects.toThrow('Atomic quota consumption only supports incrementBy=1');
    });

    it('should throw on database error', async () => {
      const rpcMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'RPC error' },
      });

      vi.mocked(supabase.rpc).mockImplementation(rpcMock);

      await expect(tryConsumeAnalyze({
        userDbId: 'user-123',
        cap: 10,
        incrementBy: 1,
      })).rejects.toThrow();
    });
  });

  describe('tryConsumeReply', () => {
    it('should return allowed true when quota is available', async () => {
      const rpcMock = vi.fn().mockResolvedValue({
        data: [{ allowed: true, new_count: 2 }],
        error: null,
      });

      vi.mocked(supabase.rpc).mockImplementation(rpcMock);

      const result = await tryConsumeReply({
        userDbId: 'user-123',
        cap: 5,
        incrementBy: 1,
      });

      expect(result).toEqual({ allowed: true, newCount: 2 });
      expect(rpcMock).toHaveBeenCalledWith('consume_reply_quota', {
        _user_id: 'user-123',
        _cap: 5,
      });
    });

    it('should return allowed false when quota is exceeded', async () => {
      const rpcMock = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      vi.mocked(supabase.rpc).mockImplementation(rpcMock);

      const result = await tryConsumeReply({
        userDbId: 'user-123',
        cap: 5,
        incrementBy: 1,
      });

      expect(result).toEqual({ allowed: false });
    });

    it('should throw when incrementBy is not 1', async () => {
      await expect(tryConsumeReply({
        userDbId: 'user-123',
        cap: 5,
        incrementBy: 3,
      })).rejects.toThrow('Atomic quota consumption only supports incrementBy=1');
    });
  });

  describe('incrementUsage', () => {
    it('should increment analyze count', async () => {
      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { comments_analyzed_count: 5 },
            error: null,
          }),
        }),
      });

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const insertMock = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: selectMock,
            update: updateMock,
          } as any;
        }
        if (table === 'usage_events') {
          return {
            insert: insertMock,
          } as any;
        }
        return {} as any;
      });

      await incrementUsage({
        userId: 'user-123',
        action: 'analyze',
        incrementBy: 3,
      });

      expect(updateMock).toHaveBeenCalledWith({ comments_analyzed_count: 8 });
      expect(insertMock).toHaveBeenCalledWith({
        user_id: 'user-123',
        action: 'analyze',
        count: 3,
        metadata: null,
      });
    });

    it('should increment reply count', async () => {
      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { replies_generated_count: 10 },
            error: null,
          }),
        }),
      });

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const insertMock = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: selectMock,
            update: updateMock,
          } as any;
        }
        if (table === 'usage_events') {
          return {
            insert: insertMock,
          } as any;
        }
        return {} as any;
      });

      await incrementUsage({
        userId: 'user-123',
        action: 'reply',
        incrementBy: 2,
        metadata: { commentId: 'comment-456' },
      });

      expect(updateMock).toHaveBeenCalledWith({ replies_generated_count: 12 });
      expect(insertMock).toHaveBeenCalledWith({
        user_id: 'user-123',
        action: 'reply',
        count: 2,
        metadata: { commentId: 'comment-456' },
      });
    });

    it('should throw when user not found', async () => {
      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: selectMock,
      } as any);

      await expect(incrementUsage({
        userId: 'nonexistent',
        action: 'analyze',
        incrementBy: 1,
      })).rejects.toThrow('User not found');
    });
  });
});
