'use client';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LangContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Header() {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLang();
  const router = useRouter();

  if (!user) return null;

  const initials = (user.username || user.email || 'U').slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: '#e53935' }}>
            N
          </div>
          <span className="font-bold text-lg text-gray-900">Naql</span>
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            className="text-sm font-semibold px-3 py-1 rounded-lg transition-colors"
            style={{
              background: lang === 'en' ? '#ffebee' : '#e53935',
              color: lang === 'en' ? '#e53935' : '#fff',
            }}
          >
            {lang === 'en' ? 'English' : 'العربية'}
          </button>
          <span className="text-sm text-gray-600 hidden sm:block">{user.username || user.email}</span>
          <button
            onClick={() => router.push('/profile')}
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
            style={{ background: '#ffebee', color: '#e53935', border: '1.5px solid #ffcdd2' }}
            title="Profile"
          >
            {initials}
          </button>
          <button
            onClick={() => {
              logout();
              router.push('/login');
            }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}