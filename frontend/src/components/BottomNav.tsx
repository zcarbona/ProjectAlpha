'use client';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const { user } = useAuth();
  const pathname = usePathname();
  if (!user) return null;

  const isProvider = user.role === 'provider';

  const items = isProvider
    ? [
        { href: '/provider', emoji: '🚛', label: 'FLEET' },
        { href: '/provider/jobs', emoji: '📋', label: 'JOBS' },
        { href: '/trip', emoji: '📍', label: 'TRIPS' },
        { href: '/profile', emoji: '👤', label: 'PROFILE' },
      ]
    : [
        { href: '/book', emoji: '🚛', label: 'BOOK' },
        { href: '/trip', emoji: '📍', label: 'MY TRIP' },
        { href: '/profile', emoji: '👤', label: 'PROFILE' },
      ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe">
      <div className="max-w-lg mx-auto flex justify-around">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-2 px-3 ${active ? 'text-blue-600' : 'text-gray-400'}`}
            >
              <span className="text-xl">{item.emoji}</span>
              <span className="text-[10px] font-bold tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
