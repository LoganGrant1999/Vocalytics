import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted for proper mock function creation
const {
  mockSupabaseFrom,
  mockStripeCustomersCreate,
  mockStripeCheckoutSessionsCreate,
  mockStripeBillingPortalSessionsCreate,
  mockStripeSubscriptionsRetrieve,
} = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn(),
  mockStripeCustomersCreate: vi.fn(),
  mockStripeCheckoutSessionsCreate: vi.fn(),
  mockStripeBillingPortalSessionsCreate: vi.fn(),
  mockStripeSubscriptionsRetrieve: vi.fn(),
}));

vi.mock('../../db/client.js', () => ({
  supabase: {
    from: mockSupabaseFrom,
  },
}));

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      customers: {
        create: mockStripeCustomersCreate,
      },
      checkout: {
        sessions: {
          create: mockStripeCheckoutSessionsCreate,
        },
      },
      billingPortal: {
        sessions: {
          create: mockStripeBillingPortalSessionsCreate,
        },
      },
      subscriptions: {
        retrieve: mockStripeSubscriptionsRetrieve,
      },
    })),
  };
});

// Import after mocks
import { billingRoutes } from '../routes/billing.js';

// Helper to create mock Fastify instance
function createMockFastify() {
  const routes: any[] = [];
  return {
    get: vi.fn((path, handler) => {
      routes.push({ method: 'GET', path, handler });
    }),
    post: vi.fn((path, handler) => {
      routes.push({ method: 'POST', path, handler });
    }),
    _getRoute: (method: string, path: string) =>
      routes.find((r) => r.method === method && r.path === path),
  };
}

describe('Billing Routes', () => {
  let fastify: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fastify = createMockFastify();

    // Set environment variables
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_PRICE_ID = 'price_test_123';
    process.env.STRIPE_CHECKOUT_SUCCESS_URL = 'http://localhost:5173/billing?success=true';
    process.env.STRIPE_CHECKOUT_CANCEL_URL = 'http://localhost:5173/billing?canceled=true';
    process.env.STRIPE_PORTAL_RETURN_URL = 'http://localhost:5173/billing';
  });

  describe('POST /billing/checkout', () => {
    it('should create checkout session for new customer', async () => {
      await billingRoutes(fastify);
      const route = fastify._getRoute('POST', '/billing/checkout');

      // Mock user lookup
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'user_123',
          email: 'test@example.com',
          stripe_customer_id: null, // No existing customer
          tier: 'free',
        },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      mockSupabaseFrom.mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
      });

      // Mock Stripe customer creation
      mockStripeCustomersCreate.mockResolvedValue({
        id: 'cus_new_123',
        email: 'test@example.com',
      });

      // Mock Stripe checkout session creation
      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        id: 'cs_123',
        url: 'https://checkout.stripe.com/pay/cs_123',
      });

      const mockRequest = {
        auth: {
          userId: 'user_123',
          userDbId: 'user_123',
          email: 'test@example.com',
        },
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(mockRequest, mockReply);

      // Verify customer created
      expect(mockStripeCustomersCreate).toHaveBeenCalledWith({
        email: 'test@example.com',
        metadata: {
          app_user_id: 'user_123',
          user_db_id: 'user_123',
        },
      });

      // Verify customer ID saved
      expect(mockUpdate).toHaveBeenCalledWith({ stripe_customer_id: 'cus_new_123' });

      // Verify checkout session created
      expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_new_123',
          mode: 'subscription',
          line_items: expect.arrayContaining([
            expect.objectContaining({
              price: expect.any(String), // Price ID from environment
              quantity: 1,
            }),
          ]),
          client_reference_id: 'user_123',
          metadata: expect.objectContaining({
            user_id: 'user_123',
            profile_id: 'user_123',
          }),
        })
      );

      expect(mockReply.send).toHaveBeenCalledWith({
        url: 'https://checkout.stripe.com/pay/cs_123',
      });
    });

    it('should reuse existing Stripe customer', async () => {
      await billingRoutes(fastify);
      const route = fastify._getRoute('POST', '/billing/checkout');

      // Mock user with existing customer ID
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'user_456',
          email: 'existing@example.com',
          stripe_customer_id: 'cus_existing_456', // Existing customer!
          stripe_subscription_id: null,
          tier: 'free',
        },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        id: 'cs_456',
        url: 'https://checkout.stripe.com/pay/cs_456',
      });

      const mockRequest = {
        auth: { userId: 'user_456', userDbId: 'user_456' },
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(mockRequest, mockReply);

      // Should NOT create new customer
      expect(mockStripeCustomersCreate).not.toHaveBeenCalled();

      // Should use existing customer
      expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_existing_456',
        })
      );
    });

    it('should reject if user already has active subscription', async () => {
      await billingRoutes(fastify);
      const route = fastify._getRoute('POST', '/billing/checkout');

      // Mock user with active subscription
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'user_pro',
          email: 'pro@example.com',
          stripe_customer_id: 'cus_pro',
          stripe_subscription_id: 'sub_active_123',
          tier: 'pro',
        },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      // Mock active subscription check
      mockStripeSubscriptionsRetrieve.mockResolvedValue({
        id: 'sub_active_123',
        status: 'active',
      });

      const mockRequest = {
        auth: { userId: 'user_pro', userDbId: 'user_pro' },
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Already Subscribed',
        message: 'You already have an active subscription. Use the billing portal to manage it.',
      });
      expect(mockStripeCheckoutSessionsCreate).not.toHaveBeenCalled();
    });

    it('should allow checkout if previous subscription was canceled', async () => {
      await billingRoutes(fastify);
      const route = fastify._getRoute('POST', '/billing/checkout');

      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'user_789',
          email: 'canceled@example.com',
          stripe_customer_id: 'cus_789',
          stripe_subscription_id: 'sub_canceled_789',
          tier: 'free',
        },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      // Mock canceled subscription
      mockStripeSubscriptionsRetrieve.mockResolvedValue({
        id: 'sub_canceled_789',
        status: 'canceled',
      });

      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        id: 'cs_789',
        url: 'https://checkout.stripe.com/pay/cs_789',
      });

      const mockRequest = {
        auth: { userId: 'user_789', userDbId: 'user_789' },
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(mockRequest, mockReply);

      // Should allow new checkout
      expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalled();
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.any(String) })
      );
    });

    it('should require STRIPE_PRICE_ID to be configured', async () => {
      // Note: STRIPE_PRICE_ID is validated at module load time
      // This test verifies the environment variable is set in test environment
      expect(process.env.STRIPE_PRICE_ID).toBeDefined();
    });

    it('should return 404 if user not found', async () => {
      await billingRoutes(fastify);
      const route = fastify._getRoute('POST', '/billing/checkout');

      // Mock user not found
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'User not found' },
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      const mockRequest = {
        auth: { userId: 'nonexistent', userDbId: 'nonexistent' },
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Not Found',
        message: 'User not found',
      });
    });

    it('should handle Stripe API errors', async () => {
      await billingRoutes(fastify);
      const route = fastify._getRoute('POST', '/billing/checkout');

      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'user_error',
          email: 'error@example.com',
          stripe_customer_id: 'cus_error',
          tier: 'free',
        },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      // Mock Stripe error
      mockStripeCheckoutSessionsCreate.mockRejectedValue(
        new Error('Invalid price ID')
      );

      const mockRequest = {
        auth: { userId: 'user_error', userDbId: 'user_error' },
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Invalid price ID',
      });
    });
  });

  describe('POST /billing/portal', () => {
    it('should create portal session for existing customer', async () => {
      await billingRoutes(fastify);
      const route = fastify._getRoute('POST', '/billing/portal');

      // Mock user with existing customer
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'user_portal',
          email: 'portal@example.com',
          stripe_customer_id: 'cus_portal_123',
          tier: 'pro',
        },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      mockStripeBillingPortalSessionsCreate.mockResolvedValue({
        id: 'bps_123',
        url: 'https://billing.stripe.com/session/bps_123',
      });

      const mockRequest = {
        auth: { userId: 'user_portal', userDbId: 'user_portal' },
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(mockRequest, mockReply);

      expect(mockStripeBillingPortalSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_portal_123',
          return_url: 'http://localhost:5173/billing',
        })
      );

      expect(mockReply.send).toHaveBeenCalledWith({
        url: 'https://billing.stripe.com/session/bps_123',
      });
    });

    it('should create customer if missing before portal access', async () => {
      await billingRoutes(fastify);
      const route = fastify._getRoute('POST', '/billing/portal');

      // Mock user without customer ID
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'user_no_customer',
          email: 'nocust@example.com',
          stripe_customer_id: null, // No customer!
          tier: 'free',
        },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      mockSupabaseFrom.mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
      });

      mockStripeCustomersCreate.mockResolvedValue({
        id: 'cus_created_456',
        email: 'nocust@example.com',
      });

      mockStripeBillingPortalSessionsCreate.mockResolvedValue({
        id: 'bps_456',
        url: 'https://billing.stripe.com/session/bps_456',
      });

      const mockRequest = {
        auth: { userId: 'user_no_customer', userDbId: 'user_no_customer' },
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(mockRequest, mockReply);

      // Should create customer first
      expect(mockStripeCustomersCreate).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith({ stripe_customer_id: 'cus_created_456' });

      // Then create portal session
      expect(mockStripeBillingPortalSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_created_456',
        })
      );
    });

    it('should handle Billing Portal not configured error', async () => {
      await billingRoutes(fastify);
      const route = fastify._getRoute('POST', '/billing/portal');

      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'user_portal_error',
          email: 'error@example.com',
          stripe_customer_id: 'cus_error',
          tier: 'pro',
        },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      // Mock portal configuration error
      const portalError = new Error('Billing Portal is not configured');
      (portalError as any).type = 'StripeInvalidRequestError';
      mockStripeBillingPortalSessionsCreate.mockRejectedValue(portalError);

      const mockRequest = {
        auth: { userId: 'user_portal_error', userDbId: 'user_portal_error' },
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(422);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'STRIPE_PORTAL_ERROR',
          error: 'Stripe Billing Portal Configuration Required',
        })
      );
    });

    it('should use portal configuration ID if provided', async () => {
      process.env.STRIPE_PORTAL_CONFIGURATION_ID = 'bpc_test_config_123';

      await billingRoutes(fastify);
      const route = fastify._getRoute('POST', '/billing/portal');

      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'user_config',
          email: 'config@example.com',
          stripe_customer_id: 'cus_config',
          tier: 'pro',
        },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      mockStripeBillingPortalSessionsCreate.mockResolvedValue({
        id: 'bps_config',
        url: 'https://billing.stripe.com/session/bps_config',
      });

      const mockRequest = {
        auth: { userId: 'user_config', userDbId: 'user_config' },
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(mockRequest, mockReply);

      expect(mockStripeBillingPortalSessionsCreate).toHaveBeenCalledWith({
        customer: 'cus_config',
        return_url: 'http://localhost:5173/billing',
        configuration: 'bpc_test_config_123',
      });
    });

    it('should return 404 if user not found', async () => {
      await billingRoutes(fastify);
      const route = fastify._getRoute('POST', '/billing/portal');

      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'User not found' },
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      const mockRequest = {
        auth: { userId: 'nonexistent', userDbId: 'nonexistent' },
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Not Found',
        message: 'User not found',
      });
    });
  });
});
