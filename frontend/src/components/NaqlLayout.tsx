'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LangContext';

interface NaqlLayoutProps {
  children: ReactNode;
}

export default function NaqlLayout({ children }: NaqlLayoutProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLang();

  const nav = [
    { name: t('Home', 'الصفحة الرئيسية'), href: '/', icon: '♔' },
    { name: t('Book', 'طلب'), href: '/book', icon: '▣' },
    { name: t('Trips', 'الرحالت'), href: '/trip', icon: '⌖' },
    { name: t('Profile', 'البروفايل'), href: '/profile', icon: '♙' },
  ];

  const initials = (user?.username || user?.email || 'U').slice(0, 2).toUpperCase();

  return (
    <div className="naql-app">
      {/* HEADER */}
      <header className="naql-header">
        <Link href="/" className="brand">
          <span className="brand-logo">N</span>
          <span>Naql</span>
        </Link>

        <div className="header-search">
          <span>⌕</span>
          <input
            placeholder={t('Search for truck, location, or service...', 'ابحث عن شاحنة أو موقع...')}
            aria-label="Search"
          />
        </div>

        <div className="header-actions">
          <button
            className="language"
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
          >
            {lang === 'en' ? 'English' : 'العربية'}
          </button>

          <button className="notification">
            ♧
            <span>3</span>
          </button>

          <Link href="/profile" className="avatar">
            {initials}
          </Link>

          <span className="arrow">▾</span>
        </div>
      </header>

      {/* BODY */}
      <div className="naql-body">
        <aside className="sidebar">
          <nav>
            {nav.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${active ? 'active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              );
            })}

            <button
              className="nav-item more"
              onClick={() => {
                logout();
                window.location.href = '/login';
              }}
            >
              <span className="nav-icon">•••</span>
              <span>{t('Sign Out', 'تسجيل الخروج')}</span>
            </button>
          </nav>
        </aside>

        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}