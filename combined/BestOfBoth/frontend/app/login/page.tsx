'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(identifier, password);
      router.push('/book');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8" style={{ border: '1px solid #e5e7eb' }}>
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-3xl" style={{ background: '#e53935' }}>
            N
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-900">Welcome Back</h1>

        {error && (
          <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: '#ffebee', border: '1px solid #ffcdd2', color: '#b91c1c' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Username, Email, or Phone</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full p-3 border rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none"
              style={{ borderColor: '#e5e7eb' }}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none"
              style={{ borderColor: '#e5e7eb' }}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full p-4 text-white rounded-xl font-bold disabled:opacity-50 transition-colors"
            style={{ background: '#e53935' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          {"Don't have an account? "}
          <Link href="/register" className="font-semibold hover:opacity-80" style={{ color: '#e53935' }}>
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
