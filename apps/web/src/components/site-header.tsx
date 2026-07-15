'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api, getAccessToken, setAccessToken, restoreSession } from '@/lib/api';
import { BrandLogo } from '@/components/layout/brand-logo';

const nav = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/docs', label: 'Docs' },
  { href: '/blog', label: 'Blog' },
  { href: '/support', label: 'Support' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadAuth() {
      await restoreSession();
      if (cancelled) return;

      const token = getAccessToken();
      if (!token) {
        setUser(null);
        setPlan(null);
        setLoading(false);
        return;
      }

      api
        .me()
        .then((res) => {
          if (cancelled) return;
          setUser(res.user);
          setPlan(res.organization?.plan ?? 'free');
        })
        .catch(() => {
          if (cancelled) return;
          setAccessToken(null);
          setUser(null);
          setPlan(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    void loadAuth();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    setAccessToken(null);
    setUser(null);
    setPlan(null);
    window.location.href = '/';
  }

  const isDashboard = pathname.startsWith('/dashboard');

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 glass">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <BrandLogo size="sm" />
        <nav className="hidden gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground no-underline transition-colors hover:bg-primary/5 hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {!loading && user ? (
            <>
              <Link
                href="/dashboard"
                className="hidden rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground no-underline transition-colors hover:text-primary sm:inline"
              >
                Dashboard
              </Link>
              <span className="hidden rounded-lg bg-primary/10 px-2 py-1 text-xs font-semibold capitalize text-primary md:inline">
                {plan}
              </span>
              <span className="hidden max-w-[140px] truncate text-xs text-muted-foreground lg:inline" title={user.id}>
                {user.email}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                Log out
              </button>
            </>
          ) : (
            !loading && (
              <>
                <Link
                  href="/login"
                  className="rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground no-underline transition-colors hover:text-primary"
                >
                  Log in
                </Link>
                {!isDashboard && (
                  <Link href="/register" className="btn-primary px-4 py-2 text-sm">
                    Start free
                  </Link>
                )}
              </>
            )
          )}
        </div>
      </div>
    </header>
  );
}
