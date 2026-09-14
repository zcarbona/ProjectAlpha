'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LangContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const { user } = useAuth();
  const { lang, t } = useLang();
  const pathname = usePathname();
  if (!user) return null;

  const isProvider = user.role === 'provider';

  const items = isProvider
    ? [
        { href: '/provider', emoji: '🚛', label: t('FLEET', 'سيارات'), number: '1' },
        { href: '/provider/jobs', emoji: '📋', label: t('JOBS', 'مهام'), number: '2' },
        { href: '/trip', emoji: '📍', label: t('TRIPS', 'الرحالت'), number: '3' },
      ]
    : [
        { href: '/book', emoji: '🚛', label: t('BOOK', 'طلب'), number: '1' },
        { href: '/trip', emoji: '📍', label: t('TRIPS', 'الرحالت'), number: '2' },
        { href: '/chat', emoji: '💬', label: t('CHAT', 'دردشة'), number: '3' },
      ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t pb-safe" style={{ borderColor: '#e5e7eb' }}>
      <div className="max-w-lg mx-auto flex justify-around">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center py-2 px-3"
              style={{ color: active ? '#e53935' : '#9ca3af' }}
            >
              <span className="text-xl">{item.emoji}</span>
              <span className="text-[10px] font-bold tracking-wide">{item.label}</span>
              <span
                className="absolute -top-1 -right-2 w-4 h-4 rounded-full flex items-center justify-center text-white"
                style={{
                  background: active ? '#e53935' : '#9ca3af',
                  fontSize: '9px',
                  fontWeight: 800,
                }}
              >
                {item.number}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}