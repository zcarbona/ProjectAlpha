'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-2xl font-bold mb-6 text-center text-slate-900">Join Naql</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 border rounded-lg bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border rounded-lg bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border rounded-lg bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
              required
              minLength={12}
            />
            <p className="text-xs text-slate-500 mt-1">Min 12 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-slate-700">I am a</label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setRole('customer')}
                className={`flex-1 p-4 rounded-xl border-2 transition-colors ${
                  role === 'customer'
                    ? 'border-amber-500 bg-amber-50 text-slate-900'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
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
                    ? 'border-amber-500 bg-amber-50 text-slate-900'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
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
            className="w-full p-4 bg-amber-500 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-amber-600 transition-colors"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <a href="/login" className="text-amber-600 font-semibold hover:text-amber-700">
            Sign In
          </a>
        </p>
      </div>
    </div>
  );
}
