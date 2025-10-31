import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordStripeEvent, markStripeEventProcessed } from '../stripe.js';

// Mock Supabase client
vi.mock('../client.js', () => {
  const mockSupabase = {
    from: vi.fn(),
  };
  return { supabase: mockSupabase };
});

import { supabase } from '../client.js';

describe('Stripe Database Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordStripeEvent', () => {
    it('should insert new event and return isNew: true', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any);

      const result = await recordStripeEvent({
        eventId: 'evt_test_123',
        type: 'checkout.session.completed',
        payload: { id: 'cs_test_123' },
      });

      expect(result).toEqual({ isNew: true });
      expect(supabase.from).toHaveBeenCalledWith('stripe_events');
      expect(mockInsert).toHaveBeenCalledWith({
        event_id: 'evt_test_123',
        type: 'checkout.session.completed',
        payload: { id: 'cs_test_123' },
        processed: false,
      });
    });

    it('should detect duplicate events (idempotency) and return isNew: false', async () => {
      const duplicateError = {
        code: '23505', // PostgreSQL unique constraint violation
        message: 'duplicate key value violates unique constraint',
      };

      const mockInsert = vi.fn().mockResolvedValue({ error: duplicateError });

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any);

      const result = await recordStripeEvent({
        eventId: 'evt_test_456',
        type: 'customer.subscription.updated',
        payload: { id: 'sub_test_123' },
      });

      expect(result).toEqual({ isNew: false });
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should throw error for non-duplicate database errors', async () => {
      const dbError = {
        code: '42P01', // PostgreSQL table not found
        message: 'relation "stripe_events" does not exist',
      };

      const mockInsert = vi.fn().mockResolvedValue({ error: dbError });

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any);

      await expect(
        recordStripeEvent({
          eventId: 'evt_test_789',
          type: 'invoice.paid',
          payload: { id: 'in_test_123' },
        })
      ).rejects.toEqual(dbError);
    });

    it('should handle complex payload objects', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any);

      const complexPayload = {
        id: 'sub_123',
        customer: 'cus_123',
        items: {
          data: [{ id: 'si_123', price: { id: 'price_123' } }],
        },
        metadata: { user_id: 'user_123' },
      };

      await recordStripeEvent({
        eventId: 'evt_complex',
        type: 'customer.subscription.created',
        payload: complexPayload,
      });

      expect(mockInsert).toHaveBeenCalledWith({
        event_id: 'evt_complex',
        type: 'customer.subscription.created',
        payload: complexPayload,
        processed: false,
      });
    });
  });

  describe('markStripeEventProcessed', () => {
    it('should mark event as processed', async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as any);

      await markStripeEventProcessed('evt_test_123');

      expect(supabase.from).toHaveBeenCalledWith('stripe_events');
      expect(mockUpdate).toHaveBeenCalledWith({ processed: true });
      expect(mockEq).toHaveBeenCalledWith('event_id', 'evt_test_123');
    });

    it('should throw error if update fails', async () => {
      const dbError = {
        code: 'PGRST116',
        message: 'Row not found',
      };

      const mockEq = vi.fn().mockResolvedValue({ error: dbError });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as any);

      await expect(
        markStripeEventProcessed('evt_nonexistent')
      ).rejects.toEqual(dbError);
    });

    it('should only update specific event by ID', async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as any);

      await markStripeEventProcessed('evt_specific_123');

      expect(mockEq).toHaveBeenCalledWith('event_id', 'evt_specific_123');
      expect(mockEq).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event Processing Order', () => {
    it('should handle record → process → mark workflow', async () => {
      // Step 1: Record event
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any);

      const recordResult = await recordStripeEvent({
        eventId: 'evt_workflow',
        type: 'checkout.session.completed',
        payload: { id: 'cs_123' },
      });

      expect(recordResult.isNew).toBe(true);

      // Step 2: Mark as processed
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as any);

      await markStripeEventProcessed('evt_workflow');

      expect(mockUpdate).toHaveBeenCalledWith({ processed: true });
    });
  });
});
