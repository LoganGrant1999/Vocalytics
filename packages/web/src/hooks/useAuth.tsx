import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  tier: 'free' | 'pro';
  emailVerified: boolean;
  hasYouTubeConnected: boolean;
  createdAt: string;
  subscription_status?: string;
  subscribed_until?: string;
}

interface Quota {
  analyze_weekly_count: number;
  analyze_weekly_limit: number;
  reply_daily_count: number;
  reply_daily_limit: number;
  period_start: string;
}

interface AuthContextType {
  user: User | null;
  quota: Quota | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch current user on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await api.getCurrentUser();
        setUser(data.user);
        setQuota(data.quota || null);
      } catch (error) {
        console.log('Not authenticated');
        setUser(null);
        setQuota(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []);

  const refreshUser = async () => {
    try {
      const data = await api.getCurrentUser();
      setUser(data.user);
      setQuota(data.quota || null);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const login = async (email: string, password: string) => {
    const data = await api.login({ email, password });
    setUser(data.user);

    // Fetch quota after login
    try {
      const userData = await api.getCurrentUser();
      setQuota(userData.quota || null);
    } catch (error) {
      console.warn('Failed to fetch quota:', error);
    }

    // Navigate based on YouTube connection status
    if (data.user.hasYouTubeConnected) {
      navigate('/app/dashboard');
    } else {
      navigate('/connect');
    }
  };

  const register = async (data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) => {
    const response = await api.register(data);
    setUser(response.user);

    // Fetch quota after registration
    try {
      const userData = await api.getCurrentUser();
      setQuota(userData.quota || null);
    } catch (error) {
      console.warn('Failed to fetch quota:', error);
    }

    // After registration, prompt to connect YouTube
    navigate('/connect');
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    setQuota(null);
    navigate('/signin');
  };

  const value = {
    user,
    quota,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
