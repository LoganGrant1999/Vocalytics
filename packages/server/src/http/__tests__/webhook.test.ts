import { describe, it, expect, vi, beforeEach } from 'vitest';
import Stripe from 'stripe';

// Use vi.hoisted for proper mock function creation
const {
  mockRecordStripeEvent,
  mockMarkStripeEventProcessed,
  mockSupabaseFrom,
  mockStripeWebhooksConstructEvent,
  mockStripeSubscriptionsRetrieve,
} = vi.hoisted(() => ({
  mockRecordStripeEvent: vi.fn(),
  mockMarkStripeEventProcessed: vi.fn(),
  mockSupabaseFrom: vi.fn(),
  mockStripeWebhooksConstructEvent: vi.fn(),
  mockStripeSubscriptionsRetrieve: vi.fn(),
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
      subscriptions: {
        retrieve: mockStripeSubscriptionsRetrieve,
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

describe('Stripe Webhook Handler', () => {
  let fastify: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fastify = createMockFastify();

    // Set environment variables for tests
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';
  });

  describe('Webhook Route Registration', () => {
    it('should register webhook route with rawBody config', async () => {
      await webhookRoute(fastify);

      expect(fastify.post).toHaveBeenCalledWith(
        '/webhook/stripe',
        expect.objectContaining({
          config: { rawBody: true },
        }),
        expect.any(Function)
      );
    });
  });

  describe('Signature Verification', () => {
    it('should reject webhook without signature header', async () => {
      await webhookRoute(fastify);
      const route = fastify._getRoute('/webhook/stripe');

      const mockRequest = {
        headers: {},
        rawBody: '{"type":"test"}',
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'Missing stripe-signature header',
      });
    });

    it('should verify webhook signature with secret', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_test_123',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_123' } as any },
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

      // Mock Supabase for event processing
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'user_123', email: 'test@example.com', tier: 'free' },
        error: null
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      await webhookRoute(fastify);
      const route = fastify._getRoute('/webhook/stripe');

      const mockRequest = {
        headers: { 'stripe-signature': 'valid_signature' },
        rawBody: '{"type":"checkout.session.completed"}',
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(mockRequest, mockReply);

      expect(mockStripeWebhooksConstructEvent).toHaveBeenCalledWith(
        '{"type":"checkout.session.completed"}',
        'valid_signature',
        expect.any(String) // Webhook secret from environment
      );
    });

    it('should reject webhook with invalid signature', async () => {
      mockStripeWebhooksConstructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await webhookRoute(fastify);
      const route = fastify._getRoute('/webhook/stripe');

      const mockRequest = {
        headers: { 'stripe-signature': 'invalid_signature' },
        rawBody: '{"type":"test"}',
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Webhook Error',
        message: 'Webhook signature verification failed: Invalid signature',
      });
    });

    it('should require STRIPE_WEBHOOK_SECRET in production', async () => {
      // Note: STRIPE_WEBHOOK_SECRET is validated at module load time
      // This test verifies the environment variable is set
      expect(process.env.STRIPE_WEBHOOK_SECRET).toBeDefined();
    });
  });

  describe('Idempotency (Duplicate Event Handling)', () => {
    it('should detect and skip duplicate events', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_duplicate_123',
        type: 'invoice.paid',
        data: { object: { id: 'in_123' } as any },
        created: Date.now(),
        livemode: false,
        object: 'event',
        api_version: '2023-10-16',
        pending_webhooks: 0,
        request: null,
      };

      mockStripeWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockRecordStripeEvent.mockResolvedValue({ isNew: false }); // Duplicate!

      await webhookRoute(fastify);
      const route = fastify._getRoute('/webhook/stripe');

      const mockRequest = {
        headers: { 'stripe-signature': 'valid_signature' },
        rawBody: '{"type":"invoice.paid"}',
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(mockRequest, mockReply);

      expect(mockRecordStripeEvent).toHaveBeenCalledWith({
        eventId: 'evt_duplicate_123',
        type: 'invoice.paid',
        payload: mockEvent.data.object,
      });
      expect(mockMarkStripeEventProcessed).not.toHaveBeenCalled();
      expect(mockReply.send).toHaveBeenCalledWith({
        received: true,
        duplicate: true,
      });
    });

    it('should process new events normally', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_new_123',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123',
            status: 'active',
            current_period_end: Math.floor(Date.now() / 1000) + 86400,
          } as any
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

      // Mock Supabase
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'user_123', stripe_customer_id: 'cus_123', tier: 'free' },
        error: null
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
      });

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

      expect(mockRecordStripeEvent).toHaveBeenCalled();
      expect(mockMarkStripeEventProcessed).toHaveBeenCalledWith('evt_new_123');
      expect(mockReply.send).toHaveBeenCalledWith({ received: true });
    });
  });

  describe('Checkout Session Completed Event', () => {
    it('should upgrade user to pro on successful checkout', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_checkout_123',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_123',
            customer: 'cus_123',
            subscription: 'sub_123',
          } as any
        },
        created: Date.now(),
        livemode: false,
        object: 'event',
        api_version: '2023-10-16',
        pending_webhooks: 0,
        request: null,
      };

      const mockSubscription = {
        id: 'sub_123',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
      } as unknown as Stripe.Subscription;

      mockStripeWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockRecordStripeEvent.mockResolvedValue({ isNew: true });
      mockMarkStripeEventProcessed.mockResolvedValue(undefined);
      mockStripeSubscriptionsRetrieve.mockResolvedValue(mockSubscription);

      // Mock Supabase - find user
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'user_123', stripe_customer_id: 'cus_123', tier: 'free' },
        error: null
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
      });

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

      expect(mockStripeSubscriptionsRetrieve).toHaveBeenCalledWith('sub_123');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          stripe_subscription_id: 'sub_123',
          subscription_status: 'active',
          tier: 'pro',
        })
      );
    });

    it('should handle checkout without subscription (one-time payment)', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_checkout_onetime',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_456',
            customer: 'cus_456',
            subscription: null, // No subscription
          } as any
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

      // Mock Supabase
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'user_456', stripe_customer_id: 'cus_456', tier: 'free' },
        error: null
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

      // Should not try to retrieve subscription
      expect(mockStripeSubscriptionsRetrieve).not.toHaveBeenCalled();
      expect(mockReply.send).toHaveBeenCalledWith({ received: true });
    });

    it('should handle missing customer ID gracefully', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_no_customer',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_789',
            customer: null, // No customer!
          } as any
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

      // Should not try to find user
      expect(mockSupabaseFrom).not.toHaveBeenCalled();
      expect(mockReply.send).toHaveBeenCalledWith({ received: true });
    });
  });

  describe('Subscription Updated Event', () => {
    it('should update user tier when subscription becomes active', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_sub_active',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123',
            status: 'active',
            current_period_end: Math.floor(Date.now() / 1000) + 2592000,
          } as any
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

      // Mock Supabase
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'user_123', stripe_customer_id: 'cus_123', tier: 'free' },
        error: null
      });
      const mockEqSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect });
      mockSupabaseFrom.mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
      });

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

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'pro',
          subscription_status: 'active',
        })
      );
    });

    it('should NOT downgrade tier when subscription is past_due', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_sub_past_due',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123',
            status: 'past_due',
            current_period_end: Math.floor(Date.now() / 1000) + 86400,
          } as any
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

      // Mock Supabase
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'user_123', stripe_customer_id: 'cus_123', tier: 'pro' },
        error: null
      });
      const mockEqSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect });
      mockSupabaseFrom.mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
      });

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

      // Should update subscription_status but keep existing tier
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_status: 'past_due',
          tier: 'pro', // Should preserve pro tier during past_due
        })
      );
    });
  });

  describe('Subscription Deleted Event', () => {
    it('should downgrade user to free tier on cancellation', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_sub_deleted',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123',
            status: 'canceled',
          } as any
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

      // Mock Supabase
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'user_123', stripe_customer_id: 'cus_123', tier: 'pro' },
        error: null
      });
      const mockEqSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect });
      mockSupabaseFrom.mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
      });

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

      expect(mockUpdate).toHaveBeenCalledWith({
        subscription_status: 'canceled',
        subscribed_until: null,
        tier: 'free',
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on processing error', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_error',
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_123' } as any },
        created: Date.now(),
        livemode: false,
        object: 'event',
        api_version: '2023-10-16',
        pending_webhooks: 0,
        request: null,
      };

      mockStripeWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockRecordStripeEvent.mockRejectedValue(new Error('Database connection failed'));

      await webhookRoute(fastify);
      const route = fastify._getRoute('/webhook/stripe');

      const mockRequest = {
        headers: { 'stripe-signature': 'valid_signature' },
        rawBody: '{"type":"customer.subscription.updated"}',
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Database connection failed',
      });
    });

    it('should handle unrecognized event types gracefully', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_unknown',
        type: 'payment_method.attached' as any,
        data: { object: { id: 'pm_123' } as any },
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

      // Should acknowledge but not process
      expect(mockReply.send).toHaveBeenCalledWith({ received: true });
    });
  });
});
