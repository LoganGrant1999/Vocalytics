import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  upsertUser,
  getUserById,
  getUserByAppUserId,
  getUserByStripeCustomerId,
  updateUserStripe
} from '../users.js';

// Mock the Supabase client
vi.mock('../client.js', () => {
  const mockSupabase = {
    from: vi.fn(),
  };

  return {
    supabase: mockSupabase,
    type: {} as any,
  };
});

import { supabase } from '../client.js';

describe('users.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('upsertUser', () => {
    it('should create a new user when user does not exist', async () => {
      const mockUser = {
        id: 'user-123',
        app_user_id: 'app-user-123',
        email: 'test@example.com',
        tier: 'free',
        comments_analyzed_count: 0,
        replies_generated_count: 0,
      };

      // Mock the select query to return no existing user
      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      // Mock the insert query
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
        }),
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: selectMock,
            insert: insertMock,
            update: vi.fn(),
          } as any;
        }
        return {} as any;
      });

      const result = await upsertUser({
        appUserId: 'app-user-123',
        email: 'test@example.com',
      });

      expect(result).toEqual(mockUser);
      expect(insertMock).toHaveBeenCalledWith({
        app_user_id: 'app-user-123',
        email: 'test@example.com',
        tier: 'free',
        comments_analyzed_count: 0,
        replies_generated_count: 0,
      });
    });

    it('should return existing user when user already exists and email unchanged', async () => {
      const existingUser = {
        id: 'user-123',
        app_user_id: 'app-user-123',
        email: 'test@example.com',
        tier: 'free',
      };

      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: existingUser, error: null }),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: selectMock,
        insert: vi.fn(),
        update: vi.fn(),
      } as any);

      const result = await upsertUser({
        appUserId: 'app-user-123',
        email: 'test@example.com',
      });

      expect(result).toEqual(existingUser);
    });

    it('should update email when user exists but email is different', async () => {
      const existingUser = {
        id: 'user-123',
        app_user_id: 'app-user-123',
        email: 'old@example.com',
        tier: 'free',
      };

      const updatedUser = {
        ...existingUser,
        email: 'new@example.com',
      };

      let callCount = 0;
      const selectMock = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call - select existing user
          return {
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: existingUser, error: null }),
            }),
          };
        }
        // Subsequent calls
        return {
          eq: vi.fn(),
          single: vi.fn(),
        };
      });

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedUser, error: null }),
          }),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: selectMock,
        update: updateMock,
        insert: vi.fn(),
      } as any);

      const result = await upsertUser({
        appUserId: 'app-user-123',
        email: 'new@example.com',
      });

      expect(result).toEqual(updatedUser);
      expect(updateMock).toHaveBeenCalledWith({ email: 'new@example.com' });
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        tier: 'free',
      };

      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: selectMock,
      } as any);

      const result = await getUserById('user-123');
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' }
          }),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: selectMock,
      } as any);

      const result = await getUserById('nonexistent');
      expect(result).toBeNull();
    });

    it('should throw on database error', async () => {
      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'SOME_ERROR', message: 'Database error' }
          }),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: selectMock,
      } as any);

      await expect(getUserById('user-123')).rejects.toThrow();
    });
  });

  describe('getUserByAppUserId', () => {
    it('should return user when found by app user id', async () => {
      const mockUser = {
        id: 'user-123',
        app_user_id: 'app-user-123',
        email: 'test@example.com',
      };

      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: selectMock,
      } as any);

      const result = await getUserByAppUserId('app-user-123');
      expect(result).toEqual(mockUser);
    });
  });

  describe('getUserByStripeCustomerId', () => {
    it('should return user when found by Stripe customer ID', async () => {
      const mockUser = {
        id: 'user-123',
        stripe_customer_id: 'cus_123',
        email: 'test@example.com',
      };

      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: selectMock,
      } as any);

      const result = await getUserByStripeCustomerId('cus_123');
      expect(result).toEqual(mockUser);
    });
  });

  describe('updateUserStripe', () => {
    it('should update all Stripe-related fields', async () => {
      const updatedUser = {
        id: 'user-123',
        stripe_customer_id: 'cus_123',
        stripe_subscription_id: 'sub_123',
        subscription_status: 'active',
        subscribed_until: '2025-12-31T00:00:00.000Z',
        tier: 'pro',
      };

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedUser, error: null }),
          }),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        update: updateMock,
      } as any);

      const result = await updateUserStripe({
        userId: 'user-123',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        subscriptionStatus: 'active',
        subscribedUntil: new Date('2025-12-31'),
        tier: 'pro',
      });

      expect(result).toEqual(updatedUser);
      expect(updateMock).toHaveBeenCalledWith({
        stripe_customer_id: 'cus_123',
        stripe_subscription_id: 'sub_123',
        subscription_status: 'active',
        subscribed_until: '2025-12-31T00:00:00.000Z',
        tier: 'pro',
      });
    });

    it('should handle partial updates', async () => {
      const updatedUser = {
        id: 'user-123',
        tier: 'pro',
      };

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedUser, error: null }),
          }),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        update: updateMock,
      } as any);

      const result = await updateUserStripe({
        userId: 'user-123',
        tier: 'pro',
      });

      expect(result).toEqual(updatedUser);
      expect(updateMock).toHaveBeenCalledWith({ tier: 'pro' });
    });

    it('should handle null subscribedUntil', async () => {
      const updatedUser = {
        id: 'user-123',
        subscribed_until: null,
      };

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedUser, error: null }),
          }),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        update: updateMock,
      } as any);

      const result = await updateUserStripe({
        userId: 'user-123',
        subscribedUntil: null,
      });

      expect(result).toEqual(updatedUser);
      expect(updateMock).toHaveBeenCalledWith({ subscribed_until: null });
    });
  });
});
