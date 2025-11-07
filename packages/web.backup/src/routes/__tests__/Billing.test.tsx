import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/testUtils';
import userEvent from '@testing-library/user-event';
import Billing from '../Billing';

// Mock useSession hook
vi.mock('@/hooks/useSession', () => ({
  useSession: () => ({
    session: {
      user: {
        email: 'test@example.com',
      },
      tier: 'free',
      subscription_status: null,
    },
    isLoading: false,
  }),
}));

// Mock useBilling hook
vi.mock('@/hooks/useBilling', () => ({
  useBilling: () => ({
    createCheckoutSession: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }),
    cancelSubscription: vi.fn().mockResolvedValue({ success: true }),
    openPortal: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/portal' }),
    isLoading: false,
  }),
}));

describe('Billing', () => {
  it('should render billing page', () => {
    renderWithProviders(<Billing />);

    expect(screen.getByRole('heading', { name: /billing/i })).toBeInTheDocument();
  });

  it('should display current tier for free users', () => {
    renderWithProviders(<Billing />);

    expect(screen.getByText(/free tier/i)).toBeInTheDocument();
  });

  it('should show upgrade button for free users', () => {
    renderWithProviders(<Billing />);

    const upgradeButton = screen.getByRole('button', { name: /upgrade to pro/i });
    expect(upgradeButton).toBeInTheDocument();
  });

  it('should display pricing information', () => {
    renderWithProviders(<Billing />);

    // Should show pricing for Pro tier
    expect(screen.getByText(/\$\d+/)).toBeInTheDocument();
  });

  it('should show features for free tier', () => {
    renderWithProviders(<Billing />);

    expect(screen.getByText(/limited analyses/i)).toBeInTheDocument();
  });

  it('should show features for pro tier', () => {
    renderWithProviders(<Billing />);

    expect(screen.getByText(/unlimited analyses/i)).toBeInTheDocument();
    expect(screen.getByText(/priority support/i)).toBeInTheDocument();
  });

  it('should handle upgrade button click', async () => {
    const user = userEvent.setup();
    const { useBilling } = await import('@/hooks/useBilling');
    const mockCreateCheckout = vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' });

    vi.mocked(useBilling).mockReturnValue({
      createCheckoutSession: mockCreateCheckout,
      cancelSubscription: vi.fn(),
      openPortal: vi.fn(),
      isLoading: false,
    } as any);

    renderWithProviders(<Billing />);

    const upgradeButton = screen.getByRole('button', { name: /upgrade to pro/i });
    await user.click(upgradeButton);

    await waitFor(() => {
      expect(mockCreateCheckout).toHaveBeenCalled();
    });
  });

  it('should show manage subscription button for pro users', () => {
    const { useSession } = await import('@/hooks/useSession');
    vi.mocked(useSession).mockReturnValue({
      session: {
        user: { email: 'test@example.com' },
        tier: 'pro',
        subscription_status: 'active',
      },
      isLoading: false,
    } as any);

    renderWithProviders(<Billing />);

    expect(screen.getByRole('button', { name: /manage subscription/i })).toBeInTheDocument();
  });

  it('should display usage statistics', () => {
    renderWithProviders(<Billing />);

    // Should show usage meters
    expect(screen.getByText(/analyses/i)).toBeInTheDocument();
    expect(screen.getByText(/replies/i)).toBeInTheDocument();
  });

  it('should show loading state', () => {
    const { useSession } = await import('@/hooks/useSession');
    vi.mocked(useSession).mockReturnValue({
      session: null,
      isLoading: true,
    } as any);

    renderWithProviders(<Billing />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should handle successful checkout redirect', () => {
    renderWithProviders(<Billing />, { route: '/billing?success=true' });

    expect(screen.getByText(/subscription activated/i)).toBeInTheDocument();
  });

  it('should handle canceled checkout redirect', () => {
    renderWithProviders(<Billing />, { route: '/billing?canceled=true' });

    expect(screen.getByText(/checkout canceled/i)).toBeInTheDocument();
  });
});
