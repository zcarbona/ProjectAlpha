'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'customer' | 'provider' | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) {
      setError('Please select a role (Customer or Provider).');
      return;
    }
    setError('');
    setLoading(true);

    try {
      await register(username, email, password, role);
      router.push('/book');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8" style={{ border: '1px solid #e5e7eb' }}>
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-900">Join Naql</h1>

        {error && (
          <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: '#ffebee', border: '1px solid #ffcdd2', color: '#b91c1c' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 border rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none"
              style={{ borderColor: '#e5e7eb' }}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              minLength={12}
            />
            <p className="text-xs text-gray-500 mt-1">Min 12 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">I am a</label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setRole('customer')}
                className={`flex-1 p-4 rounded-xl border-2 transition-colors ${
                  role === 'customer'
                    ? 'border-brand bg-brand-light text-gray-900'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl">📦</div>
                <div className="font-semibold text-sm">Customer</div>
              </button>
              <button
                type="button"
                onClick={() => setRole('provider')}
                className={`flex-1 p-4 rounded-xl border-2 transition-colors ${
                  role === 'provider'
                    ? 'border-brand bg-brand-light text-gray-900'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl">🚛</div>
                <div className="font-semibold text-sm">Provider</div>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full p-4 text-white rounded-xl font-bold disabled:opacity-50 transition-colors"
            style={{ background: '#e53935' }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold hover:opacity-80" style={{ color: '#e53935' }}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
