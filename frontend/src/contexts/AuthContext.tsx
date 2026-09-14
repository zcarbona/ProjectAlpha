'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/lib/types';
import {
  login as apiLogin,
  register as apiRegister,
  getCurrentUser,
  getUserStats,
  updateUserLocation,
} from '@/lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, role: 'customer' | 'provider') => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('naql_token');
    const storedUser = localStorage.getItem('naql_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('naql_token');
        localStorage.removeItem('naql_user');
      }
    }
    setLoading(false);
  }, []);

  // Save user location to database when they open the app
  useEffect(() => {
    if (!token || loading) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      console.log('[AuthContext] No geolocation available');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        console.log('[AuthContext] Got position:', pos.coords.latitude, pos.coords.longitude);
        try {
          const result = await updateUserLocation(token, pos.coords.latitude, pos.coords.longitude);
          console.log('[AuthContext] Location saved:', result);
          setUser((prev) => prev ? { ...prev, current_lat: pos.coords.latitude, current_lng: pos.coords.longitude } : prev);
        } catch (err) {
          console.error('[AuthContext] Failed to save location:', err);
        }
      },
      (err) => {
        console.log('[AuthContext] Geolocation denied or failed:', err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }, [token, loading]);

  const login = async (identifier: string, password: string) => {
    const data = await apiLogin(identifier, password);
    const userData = await getCurrentUser(data.access_token);
    setToken(data.access_token);
    setUser(userData);
    localStorage.setItem('naql_token', data.access_token);
    localStorage.setItem('naql_user', JSON.stringify(userData));
  };

  const register = async (username: string, email: string, password: string, role: 'customer' | 'provider') => {
    await apiRegister(username, email, password, role);
    await login(username, password);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('naql_token');
    localStorage.removeItem('naql_user');
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
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
