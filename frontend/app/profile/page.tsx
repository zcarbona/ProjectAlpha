'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LangContext';
import RoleGuard from '@/components/RoleGuard';
import { getUserStats, updateUser } from '@/lib/api';

function ProfilePageContent() {
  const { t } = useLang();
  const { user, token, logout, refreshUser } = useAuth();
  const [stats, setStats] = useState<{ trips: number; rating: number; savedEGP: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;
    getUserStats(token)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [token]);

  const handlePhoneSave = async () => {
    if (!token || !phoneInput.trim()) return;
    setSaving(true);
    setMessage('');
    try {
      await updateUser(token, { phone_number: phoneInput.trim() });
      await refreshUser();
      setMessage(t('Phone updated successfully', 'Phone updated successfully'));
      setPhoneInput('');
    } catch {
      setMessage(t('Failed to update phone', 'Failed to update phone'));
    } finally {
      setSaving(false);
    }
  };

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
      setMessage(t('Profile updated successfully', 'Profile updated successfully'));
    } catch {
      setMessage(t('Failed to update profile', 'Failed to update profile'));
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-avatar">
          {(user.username || user.email || 'U').slice(0, 2).toUpperCase()}
        </div>
        <h1 className="profile-name">{user.username || 'User'}</h1>
        <p className="profile-email">{user.email}</p>
      </div>

      {message && (
        <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <div className="profile-card">
        <h2 className="profile-section-title">{t('Phone Number', 'Phone Number')}</h2>
        <div className="profile-phone-row">
          <input
            type="tel"
            value={phoneInput || user.phone_number || ''}
            onChange={(e) => setPhoneInput(e.target.value)}
            className="profile-input"
            placeholder={t('Add your phone number', 'Add your phone number')}
          />
          <button
            onClick={handlePhoneSave}
            disabled={saving || !phoneInput.trim()}
            className="profile-save-btn"
          >
            {saving ? t('Adding...', 'Adding...') : t('Add', 'Add')}
          </button>
        </div>
        <p className="profile-service">Service: 01555444333</p>
      </div>

      <form onSubmit={handleUpdate} className="profile-card">
        <h2 className="profile-section-title">{t('Account Settings', 'Account Settings')}</h2>
        <div className="profile-field">
          <label>{t('Username', 'Username')}</label>
          <input name="username" type="text" defaultValue={user.username || ''} className="profile-input" />
        </div>
        <div className="profile-field">
          <label>{t('Email', 'Email')}</label>
          <input name="email" type="email" defaultValue={user.email || ''} className="profile-input" />
        </div>
        <div className="profile-field">
          <label>{t('New Password', 'New Password')}</label>
          <input
            name="password"
            type="password"
            placeholder={t('Leave blank to keep current', 'Leave blank to keep current')}
            className="profile-input"
            minLength={12}
          />
        </div>
        <button type="submit" disabled={saving} className="profile-primary-btn">
          {saving ? t('Saving...', 'Saving...') : t('Update Profile', 'Update Profile')}
        </button>
      </form>

      <div className="profile-card">
        <h2 className="profile-section-title">{t('Stats', 'Stats')}</h2>
        {loading ? (
          <div className="profile-stats-loading">Loading...</div>
        ) : stats ? (
          <div className="profile-stats">
            <div className="profile-stat">
              <div className="profile-stat-value">{stats.trips}</div>
              <div className="profile-stat-label">{t('Trips', 'Trips')}</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat-value">{stats.rating} ★</div>
              <div className="profile-stat-label">{t('Rating', 'Rating')}</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat-value">{stats.savedEGP}</div>
              <div className="profile-stat-label">{t('Saved EGP', 'Saved EGP')}</div>
            </div>
          </div>
        ) : (
          <p className="profile-empty">{t('No stats available', 'No stats available')}</p>
        )}
      </div>

      <button onClick={logout} className="profile-logout-btn">
        {t('Sign Out', 'Sign Out')}
      </button>
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
