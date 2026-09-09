'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import RoleGuard from '@/components/RoleGuard';
import { updateUser } from '@/lib/api';

const PHONE_REGEX = /^\+?[1-9]\d{1,14}$/;

function ProfilePageContent() {
  const { user, token, logout, refreshUser } = useAuth();

  // Profile Details state
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password Update state
  const [password, setPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Phone Number state
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '');
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState('');
  const [phoneError, setPhoneError] = useState('');

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  const handleProfileUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return;
    setSavingProfile(true);
    setProfileMessage('');
    setProfileError('');

    try {
      await updateUser(token, {
        ...(username ? { username } : {}),
        ...(email ? { email } : {}),
      });
      await refreshUser();
      setProfileMessage('Profile details updated successfully');
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update profile details';
      setProfileError(errorMsg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return;
    setPasswordMessage('');
    setPasswordError('');

    if (!password || password.length < 12) {
      setPasswordError('Password must be at least 12 characters');
      return;
    }

    setSavingPassword(true);
    try {
      await updateUser(token, { password });
      setPassword('');
      setPasswordMessage('Password updated successfully');
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update password';
      setPasswordError(errorMsg);
    } finally {
      setSavingPassword(false);
    }
  };

  const handlePhoneUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return;
    setPhoneMessage('');
    setPhoneError('');

    const cleanPhone = phoneNumber.trim();
    if (!cleanPhone) {
      setPhoneError('Please enter a phone number');
      return;
    }

    if (!PHONE_REGEX.test(cleanPhone)) {
      setPhoneError('Please enter a valid phone number (e.g. +2010123456789)');
      return;
    }

    setSavingPhone(true);
    try {
      const isNew = !user.phone_number;
      await updateUser(token, { phone_number: cleanPhone });
      await refreshUser();
      setPhoneNumber(cleanPhone);
      setPhoneMessage(isNew ? 'Phone number added successfully' : 'Phone number updated successfully');
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update phone number';
      setPhoneError(errorMsg);
    } finally {
      setSavingPhone(false);
    }
  };

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

          {/* Profile Details Form */}
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Profile Details</h2>

            {profileMessage && (
              <div className="p-3 bg-emerald-900/50 border border-emerald-700 text-emerald-200 rounded-lg text-sm">
                {profileMessage}
              </div>
            )}
            {profileError && (
              <div className="p-3 bg-red-900/50 border border-red-700 text-red-200 rounded-lg text-sm">
                {profileError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Username</label>
              <input
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3 border rounded-lg bg-slate-900 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Email</label>
              <input
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 border rounded-lg bg-slate-900 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="w-full p-3 bg-blue-700 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-blue-800 transition-colors"
            >
              {savingProfile ? 'Saving...' : 'Update Details'}
            </button>
          </form>

          {/* Password Update Section */}
          <div className="border-t border-slate-700 pt-6 mt-6">
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Password</h2>

              {passwordMessage && (
                <div className="p-3 bg-emerald-900/50 border border-emerald-700 text-emerald-200 rounded-lg text-sm">
                  {passwordMessage}
                </div>
              )}
              {passwordError && (
                <div className="p-3 bg-red-900/50 border border-red-700 text-red-200 rounded-lg text-sm">
                  {passwordError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1 text-slate-300">New Password</label>
                <input
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password (min 12 characters)"
                  className="w-full p-3 border rounded-lg bg-slate-900 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  minLength={12}
                />
              </div>
              <button
                type="submit"
                disabled={savingPassword}
                className="w-full p-3 bg-blue-700 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-blue-800 transition-colors"
              >
                {savingPassword ? 'Saving...' : 'Update Password'}
              </button>
            </form>
          </div>

          {/* Phone Number Section - directly under password update section */}
          <div className="border-t border-slate-700 pt-6 mt-6">
            <form onSubmit={handlePhoneUpdate} className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Phone Number</h2>

              {phoneMessage && (
                <div className="p-3 bg-emerald-900/50 border border-emerald-700 text-emerald-200 rounded-lg text-sm">
                  {phoneMessage}
                </div>
              )}
              {phoneError && (
                <div className="p-3 bg-red-900/50 border border-red-700 text-red-200 rounded-lg text-sm">
                  {phoneError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1 text-slate-300">Phone Number</label>
                <input
                  name="phone_number"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Enter phone number (e.g. +2010123456789)"
                  pattern="^\+?[1-9]\d{1,14}$"
                  className="w-full p-3 border rounded-lg bg-slate-900 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={savingPhone}
                className="w-full p-3 bg-blue-700 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-blue-800 transition-colors"
              >
                {savingPhone
                  ? 'Saving...'
                  : user.phone_number
                  ? 'Update Phone Number'
                  : 'Add Phone Number'}
              </button>
            </form>
          </div>
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
