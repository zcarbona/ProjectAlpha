'use client';
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User } from '@/lib/types';
import {
  login as apiLogin,
  register as apiRegister,
  sendRegistrationOtp,
  verifyRegistrationOtp,
  resendRegistrationOtp,
  getCurrentUser,
  refreshToken as apiRefreshToken,
  registerAuthRefresh,
  updateUserLocation,
} from '@/lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string,
    role: 'customer' | 'provider',
    phoneNumber?: string
  ) => Promise<{ message: string }>;
  sendOtp: (email: string) => Promise<any>;
  verifyOtp: (email: string, code: string) => Promise<User>;
  resendOtp: (email: string) => Promise<any>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshTokenStr, setRefreshTokenStr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setRefreshTokenStr(null);
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('naql_token');
      localStorage.removeItem('naql_refresh_token');
      localStorage.removeItem('naql_user');
    }
  }, []);

  const handleTokenRefresh = useCallback(async (): Promise<string | null> => {
    const currentRefresh = typeof window !== 'undefined' ? localStorage.getItem('naql_refresh_token') : null;
    if (!currentRefresh) {
      logout();
      return null;
    }
    try {
      const data = await apiRefreshToken(currentRefresh);
      setToken(data.access_token);
      setRefreshTokenStr(data.refresh_token);
      localStorage.setItem('naql_token', data.access_token);
      localStorage.setItem('naql_refresh_token', data.refresh_token);
      return data.access_token;
    } catch {
      logout();
      return null;
    }
  }, [logout]);

  useEffect(() => {
    registerAuthRefresh(handleTokenRefresh);
  }, [handleTokenRefresh]);

  useEffect(() => {
    const storedToken = localStorage.getItem('naql_token');
    const storedRefresh = localStorage.getItem('naql_refresh_token');
    const storedUser = localStorage.getItem('naql_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setRefreshTokenStr(storedRefresh);
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('naql_token');
        localStorage.removeItem('naql_refresh_token');
        localStorage.removeItem('naql_user');
      }
    }
    setLoading(false);
  }, []);

  // Update user coordinates on load if supported
  useEffect(() => {
    if (!token || loading) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await updateUserLocation(token, pos.coords.latitude, pos.coords.longitude);
          setUser((prev) =>
            prev ? { ...prev, current_lat: pos.coords.latitude, current_lng: pos.coords.longitude } : prev
          );
        } catch (err) {
          console.warn('[AuthContext] Location update failed:', err);
        }
      },
      (err) => {
        console.log('[AuthContext] Geolocation not available or denied:', err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, [token, loading]);

  const login = async (identifier: string, password: string) => {
    const data = await apiLogin(identifier, password);
    const userData = await getCurrentUser(data.access_token);
    setToken(data.access_token);
    setRefreshTokenStr(data.refresh_token);
    setUser(userData);
    localStorage.setItem('naql_token', data.access_token);
    localStorage.setItem('naql_refresh_token', data.refresh_token);
    localStorage.setItem('naql_user', JSON.stringify(userData));
  };

  const register = async (
    username: string,
    email: string,
    password: string,
    role: 'customer' | 'provider',
    phoneNumber?: string
  ) => {
    const res = await apiRegister(username, email, password, role, phoneNumber);
    return res;
  };

  const sendOtp = async (email: string) => {
    return sendRegistrationOtp(email);
  };

  const verifyOtp = async (email: string, code: string) => {
    return verifyRegistrationOtp(email, code);
  };

  const resendOtp = async (email: string) => {
    return resendRegistrationOtp(email);
  };

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
        loading,
        login,
        register,
        sendOtp,
        verifyOtp,
        resendOtp,
        logout,
        refreshUser,
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
