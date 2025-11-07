import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { AuthProvider, useAuthContext } from '../AuthContext';
import { ReactNode } from 'react';

// Mock fetch
global.fetch = vi.fn();

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should provide auth context', () => {
    const { result } = renderHook(() => useAuthContext(), { wrapper });

    expect(result.current).toHaveProperty('user');
    expect(result.current).toHaveProperty('login');
    expect(result.current).toHaveProperty('logout');
    expect(result.current).toHaveProperty('register');
    expect(result.current).toHaveProperty('isLoading');
  });

  it('should start with null user', () => {
    const { result } = renderHook(() => useAuthContext(), { wrapper });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should handle successful login', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      tier: 'free',
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: mockUser, token: 'test-token' }),
    } as Response);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await result.current.login({ email: 'test@example.com', password: 'password' });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  it('should handle failed login', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid credentials' }),
    } as Response);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await expect(
      result.current.login({ email: 'test@example.com', password: 'wrong' })
    ).rejects.toThrow();

    expect(result.current.user).toBeNull();
  });

  it('should handle logout', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      tier: 'free',
    };

    // Mock login
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: mockUser, token: 'test-token' }),
    } as Response);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await result.current.login({ email: 'test@example.com', password: 'password' });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    // Mock logout
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    await result.current.logout();

    await waitFor(() => {
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  it('should handle registration', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'newuser@example.com',
      tier: 'free',
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: mockUser, token: 'test-token' }),
    } as Response);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await result.current.register({
      email: 'newuser@example.com',
      password: 'password123',
      name: 'New User',
    });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  it('should persist auth token', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      tier: 'free',
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: mockUser, token: 'test-token' }),
    } as Response);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await result.current.login({ email: 'test@example.com', password: 'password' });

    await waitFor(() => {
      expect(localStorage.getItem('auth_token')).toBe('test-token');
    });
  });

  it('should clear token on logout', async () => {
    localStorage.setItem('auth_token', 'test-token');

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await result.current.logout();

    await waitFor(() => {
      expect(localStorage.getItem('auth_token')).toBeNull();
    });
  });

  it('should set loading state during operations', async () => {
    vi.mocked(global.fetch).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ user: {}, token: 'test-token' }),
              } as Response),
            100
          )
        )
    );

    const { result } = renderHook(() => useAuthContext(), { wrapper });

    const loginPromise = result.current.login({
      email: 'test@example.com',
      password: 'password',
    });

    expect(result.current.isLoading).toBe(true);

    await loginPromise;

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });
});
