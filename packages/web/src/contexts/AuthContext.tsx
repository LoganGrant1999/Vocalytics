import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  tier: 'free' | 'pro';
  emailVerified: boolean;
  hasYouTubeConnected: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ user: User }>;
  register: (data: { firstName: string; lastName: string; email: string; password: string }) => Promise<{ user: User }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch current user on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const result = await api.GET('/api/auth/me');
      if (result.data?.user) {
        setUser(result.data.user as User);
      } else {
        setUser(null);
      }
    } catch (error: any) {
      // 401 is expected when not logged in, don't log it
      if (error?.response?.status !== 401) {
        console.error('[AuthContext] Failed to check auth:', error);
      }
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const result = await api.POST('/api/auth/login', {
      body: { email, password },
    });

    if (result.error) {
      throw new Error(result.error.message || 'Login failed');
    }

    if (result.data?.user) {
      setUser(result.data.user as User);
      return { user: result.data.user as User };
    }

    throw new Error('Login failed');
  };

  const register = async (data: { firstName: string; lastName: string; email: string; password: string }) => {
    const result = await api.POST('/api/auth/register', {
      body: data,
    });

    if (result.error) {
      throw new Error(result.error.message || 'Registration failed');
    }

    if (result.data?.user) {
      setUser(result.data.user as User);
      return { user: result.data.user as User };
    }

    throw new Error('Registration failed');
  };

  const logout = async () => {
    try {
      await api.POST('/api/auth/logout', {});
    } catch (error) {
      console.error('[AuthContext] Logout error:', error);
    } finally {
      setUser(null);
    }
  };

  const refreshUser = async () => {
    await checkAuth();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
