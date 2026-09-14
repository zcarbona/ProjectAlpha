'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LangContext';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import NaqlLayout from '@/components/NaqlLayout';

const NAQL_ROUTES = ['/', '/book', '/trip', '/profile'];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { lang } = useLang();

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const useNaqlShell = !loading && user && NAQL_ROUTES.includes(pathname);

  if (useNaqlShell) {
    return <NaqlLayout>{children}</NaqlLayout>;
  }

  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <BottomNav />
    </>
  );
}