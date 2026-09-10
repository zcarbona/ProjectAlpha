'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/lib/types';
import {
  login as apiLogin,
  register as apiRegister,
  getCurrentUser,
  refreshToken as apiRefreshToken,
  updateUser,
  registerAuthRefresh,
} from '@/lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, role: 'customer' | 'provider') => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  refreshTokens: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const storeTokens = (accessToken: string | null, newRefreshToken: string | null) => {
    if (accessToken) {
      localStorage.setItem('naql_token', accessToken);
    } else {
      localStorage.removeItem('naql_token');
    }

    if (newRefreshToken) {
      localStorage.setItem('naql_refresh_token', newRefreshToken);
    } else {
      localStorage.removeItem('naql_refresh_token');
    }

    setToken(accessToken);
    setRefreshToken(newRefreshToken);
  };

  useEffect(() => {
    const storedToken = localStorage.getItem('naql_token');
    const storedRefreshToken = localStorage.getItem('naql_refresh_token');
    const storedUser = localStorage.getItem('naql_user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setRefreshToken(storedRefreshToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        logout();
      }
    }
    setLoading(false);
  }, []);

  const login = async (identifier: string, password: string) => {
    const data = await apiLogin(identifier, password);
    const userData = await getCurrentUser(data.access_token);

    storeTokens(data.access_token, data.refresh_token);
    setUser(userData);
    localStorage.setItem('naql_user', JSON.stringify(userData));
  };

  const register = async (username: string, email: string, password: string, role: 'customer' | 'provider') => {
    await apiRegister(username, email, password, role);
    await login(username, password);
  };

  const logout = () => {
    storeTokens(null, null);
    setUser(null);
    localStorage.removeItem('naql_user');
  };

  const refreshTokens = async (): Promise<string | null> => {
    const currentRefreshToken = refreshToken || localStorage.getItem('naql_refresh_token');
    if (!currentRefreshToken) {
      logout();
      return null;
    }

    try {
      const data = await apiRefreshToken(currentRefreshToken);
      storeTokens(data.access_token, data.refresh_token ?? currentRefreshToken);
      return data.access_token;
    } catch {
      logout();
      return null;
    }
  };

  useEffect(() => {
    registerAuthRefresh(async () => {
      return await refreshTokens();
    });
  }, [refreshToken]);

  const refreshUser = async () => {
    if (!token) return;
    try {
      const userData = await getCurrentUser(token);
      setUser(userData);
      localStorage.setItem('naql_user', JSON.stringify(userData));
    } catch {
      logout();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        refreshToken,
        loading,
        login,
        register,
        logout,
        refreshUser,
        refreshTokens,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}