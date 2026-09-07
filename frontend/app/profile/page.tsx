'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import RoleGuard from '@/components/RoleGuard';
import { getUserStats, updateUser } from '@/lib/api';

function ProfilePageContent() {
  const { user, token, logout, refreshUser } = useAuth();
  const [stats, setStats] = useState<{ trips: number; rating: number; savedEGP: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;
    getUserStats(token)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [token]);

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setMessage('');
    const form = e.currentTarget;
    const username = (form.elements.namedItem('username') as HTMLInputElement).value;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;

    try {
      await updateUser(token, {
        ...(username ? { username } : {}),
        ...(email ? { email } : {}),
        ...(password ? { password } : {}),
      });
      await refreshUser();
      setMessage('Profile updated successfully');
    } catch {
      setMessage('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-700">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-blue-900/50 flex items-center justify-center text-2xl font-bold text-blue-300">
              {(user.username || user.email || 'U').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{user.username || 'User'}</h1>
              <p className="text-slate-400">{user.email || user.phone_number || 'No contact info'}</p>
            </div>
          </div>

          {message && (
            <div className="mb-4 p-3 bg-emerald-900/50 border border-emerald-700 text-emerald-200 rounded-lg text-sm">
              {message}
            </div>
          )}

          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Username</label>
              <input
                name="username"
                type="text"
                defaultValue={user.username || ''}
                className="w-full p-3 border rounded-lg bg-slate-900 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Email</label>
              <input
                name="email"
                type="email"
                defaultValue={user.email || ''}
                className="w-full p-3 border rounded-lg bg-slate-900 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">New Password</label>
              <input
                name="password"
                type="password"
                placeholder="Leave blank to keep current"
                className="w-full p-3 border rounded-lg bg-slate-900 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                minLength={12}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full p-4 bg-blue-700 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-blue-800 transition-colors"
            >
              {saving ? 'Saving...' : 'Update Profile'}
            </button>
          </form>
        </div>

        <div className="bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-700">
          <h2 className="text-xl font-bold mb-4 text-white">Stats</h2>
          {loading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-slate-700 rounded w-1/2" />
              <div className="h-4 bg-slate-700 rounded w-1/3" />
            </div>
          ) : stats ? (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-white">{stats.trips}</div>
                <div className="text-sm text-slate-400">Trips</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{stats.rating} ⭐</div>
                <div className="text-sm text-slate-400">Rating</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{stats.savedEGP}</div>
                <div className="text-sm text-slate-400">Saved EGP</div>
              </div>
            </div>
          ) : (
            <p className="text-slate-400">No stats available</p>
          )}
        </div>

        <button
          onClick={logout}
          className="w-full p-4 border border-red-700 text-red-300 rounded-xl font-bold hover:bg-red-900/50 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RoleGuard allowedRoles={['customer', 'provider']}>
      <ProfilePageContent />
    </RoleGuard>
  );
}
