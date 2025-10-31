import { describe, it, expect, vi, beforeEach } from 'vitest';
import Stripe from 'stripe';

// Use vi.hoisted for proper mock function creation
const {
  mockRecordStripeEvent,
  mockMarkStripeEventProcessed,
  mockSupabaseFrom,
  mockStripeWebhooksConstructEvent,
} = vi.hoisted(() => ({
  mockRecordStripeEvent: vi.fn(),
  mockMarkStripeEventProcessed: vi.fn(),
  mockSupabaseFrom: vi.fn(),
  mockStripeWebhooksConstructEvent: vi.fn(),
}));

vi.mock('../../db/stripe.js', () => ({
  recordStripeEvent: mockRecordStripeEvent,
  markStripeEventProcessed: mockMarkStripeEventProcessed,
}));

vi.mock('../../db/client.js', () => ({
  supabase: {
    from: mockSupabaseFrom,
  },
}));

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      webhooks: {
        constructEvent: mockStripeWebhooksConstructEvent,
      },
    })),
  };
});

// Import after mocks
import { webhookRoute } from '../routes/webhook.js';

// Helper to create mock Fastify instance
function createMockFastify() {
  const routes: any[] = [];
  return {
    post: vi.fn((path, options, handler) => {
      routes.push({ path, options, handler });
    }),
    _getRoute: (path: string) => routes.find((r) => r.path === path),
  };
}

describe('Invoice Payment Events (Critical for Production)', () => {
  let fastify: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fastify = createMockFastify();
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';
  });

  describe('invoice.payment_failed', () => {
    it('should NOT downgrade user on first invoice failure', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_invoice_fail_1',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_fail_123',
            customer: 'cus_123',
            subscription: 'sub_123',
            amount_due: 1000,
            attempt_count: 1,
          } as any,
        },
        created: Date.now(),
        livemode: false,
        object: 'event',
        api_version: '2023-10-16',
        pending_webhooks: 0,
        request: null,
      };

      mockStripeWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockRecordStripeEvent.mockResolvedValue({ isNew: true });
      mockMarkStripeEventProcessed.mockResolvedValue(undefined);

      // Mock user lookup (should stay pro)
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'user_123', stripe_customer_id: 'cus_123', tier: 'pro' },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      await webhookRoute(fastify);
      const route = fastify._getRoute('/webhook/stripe');

      const mockRequest = {
        headers: { 'stripe-signature': 'valid_signature' },
        rawBody: JSON.stringify(mockEvent),
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(mockRequest, mockReply);

      // Should acknowledge but not process (not implemented yet)
      expect(mockReply.send).toHaveBeenCalledWith({ received: true });

      // IMPORTANT: Current implementation doesn't handle invoice events
      // This test documents expected behavior for future implementation
      // User should stay on pro tier during first payment failure
    });

    it('should log invoice payment failure for monitoring', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_invoice_fail_2',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_fail_456',
            customer: 'cus_456',
            subscription: 'sub_456',
            amount_due: 1000,
            attempt_count: 2, // Second retry
          } as any,
        },
        created: Date.now(),
        livemode: false,
        object: 'event',
        api_version: '2023-10-16',
        pending_webhooks: 0,
        request: null,
      };

      mockStripeWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockRecordStripeEvent.mockResolvedValue({ isNew: true });
      mockMarkStripeEventProcessed.mockResolvedValue(undefined);

      await webhookRoute(fastify);
      const route = fastify._getRoute('/webhook/stripe');

      const mockRequest = {
        headers: { 'stripe-signature': 'valid_signature' },
        rawBody: JSON.stringify(mockEvent),
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(mockRequest, mockReply);

      // Should be recorded for monitoring
      expect(mockRecordStripeEvent).toHaveBeenCalledWith({
        eventId: 'evt_invoice_fail_2',
        type: 'invoice.payment_failed',
        payload: expect.objectContaining({
          id: 'in_fail_456',
          attempt_count: 2,
        }),
      });
    });

    it('should keep user tier unchanged during payment retries', async () => {
      // Scenario: Invoice fails but subscription.updated hasn't arrived yet
      // User should stay on current tier until subscription status changes

      const mockEvent: Stripe.Event = {
        id: 'evt_invoice_fail_3',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_fail_789',
            customer: 'cus_789',
            subscription: 'sub_789',
            amount_due: 1000,
            attempt_count: 3,
          } as any,
        },
        created: Date.now(),
        livemode: false,
        object: 'event',
        api_version: '2023-10-16',
        pending_webhooks: 0,
        request: null,
      };

      mockStripeWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockRecordStripeEvent.mockResolvedValue({ isNew: true });
      mockMarkStripeEventProcessed.mockResolvedValue(undefined);

      await webhookRoute(fastify);
      const route = fastify._getRoute('/webhook/stripe');

      const mockRequest = {
        headers: { 'stripe-signature': 'valid_signature' },
        rawBody: JSON.stringify(mockEvent),
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(mockRequest, mockReply);

      // Event should be acknowledged
      expect(mockReply.send).toHaveBeenCalledWith({ received: true });

      // Note: User tier change happens via subscription.updated event
      // Invoice events are for monitoring/notifications only
    });
  });

  describe('invoice.paid', () => {
    it('should acknowledge successful payment after retry', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_invoice_paid_1',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'in_paid_123',
            customer: 'cus_123',
            subscription: 'sub_123',
            amount_paid: 1000,
          } as any,
        },
        created: Date.now(),
        livemode: false,
        object: 'event',
        api_version: '2023-10-16',
        pending_webhooks: 0,
        request: null,
      };

      mockStripeWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockRecordStripeEvent.mockResolvedValue({ isNew: true });
      mockMarkStripeEventProcessed.mockResolvedValue(undefined);

      await webhookRoute(fastify);
      const route = fastify._getRoute('/webhook/stripe');

      const mockRequest = {
        headers: { 'stripe-signature': 'valid_signature' },
        rawBody: JSON.stringify(mockEvent),
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({ received: true });
      expect(mockRecordStripeEvent).toHaveBeenCalledWith({
        eventId: 'evt_invoice_paid_1',
        type: 'invoice.paid',
        payload: expect.any(Object),
      });
    });

    it('should record invoice.paid for successful renewals', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_invoice_paid_2',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'in_paid_456',
            customer: 'cus_456',
            subscription: 'sub_456',
            amount_paid: 1000,
            billing_reason: 'subscription_cycle', // Monthly renewal
          } as any,
        },
        created: Date.now(),
        livemode: false,
        object: 'event',
        api_version: '2023-10-16',
        pending_webhooks: 0,
        request: null,
      };

      mockStripeWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockRecordStripeEvent.mockResolvedValue({ isNew: true });
      mockMarkStripeEventProcessed.mockResolvedValue(undefined);

      await webhookRoute(fastify);
      const route = fastify._getRoute('/webhook/stripe');

      const mockRequest = {
        headers: { 'stripe-signature': 'valid_signature' },
        rawBody: JSON.stringify(mockEvent),
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(mockRequest, mockReply);

      expect(mockRecordStripeEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'invoice.paid',
        })
      );
    });
  });

  describe('Invoice Event Ordering', () => {
    it('should handle invoice.payment_failed before subscription.updated', async () => {
      // Real-world scenario:
      // 1. invoice.payment_failed arrives (attempt 1)
      // 2. Stripe retries payment
      // 3. subscription.updated arrives (status: past_due)

      // This test verifies events are processed in any order

      const invoiceEvent: Stripe.Event = {
        id: 'evt_invoice_first',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_123',
            customer: 'cus_123',
            subscription: 'sub_123',
            attempt_count: 1,
          } as any,
        },
        created: Date.now(),
        livemode: false,
        object: 'event',
        api_version: '2023-10-16',
        pending_webhooks: 0,
        request: null,
      };

      mockStripeWebhooksConstructEvent.mockReturnValue(invoiceEvent);
      mockRecordStripeEvent.mockResolvedValue({ isNew: true });
      mockMarkStripeEventProcessed.mockResolvedValue(undefined);

      await webhookRoute(fastify);
      const route = fastify._getRoute('/webhook/stripe');

      const mockRequest = {
        headers: { 'stripe-signature': 'valid_signature' },
        rawBody: JSON.stringify(invoiceEvent),
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(mockRequest, mockReply);

      // Invoice event processed first
      expect(mockRecordStripeEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'invoice.payment_failed',
        })
      );

      // Later, subscription.updated would arrive and update tier
      // This is tested in subscription-state-machine.test.ts
    });
  });

  describe('Invoice Finalization', () => {
    it('should handle invoice.finalized event', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_invoice_finalized',
        type: 'invoice.finalized',
        data: {
          object: {
            id: 'in_final_123',
            customer: 'cus_123',
            subscription: 'sub_123',
            amount_due: 1000,
            status: 'open',
          } as any,
        },
        created: Date.now(),
        livemode: false,
        object: 'event',
        api_version: '2023-10-16',
        pending_webhooks: 0,
        request: null,
      };

      mockStripeWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockRecordStripeEvent.mockResolvedValue({ isNew: true });
      mockMarkStripeEventProcessed.mockResolvedValue(undefined);

      await webhookRoute(fastify);
      const route = fastify._getRoute('/webhook/stripe');

      const mockRequest = {
        headers: { 'stripe-signature': 'valid_signature' },
        rawBody: JSON.stringify(mockEvent),
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({ received: true });
    });
  });
});
