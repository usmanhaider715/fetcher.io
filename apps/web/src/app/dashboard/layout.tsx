'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CreditCard,
  Download,
  FolderKanban,
  History,
  Key,
  Plug,
  Puzzle,
  Settings,
  Users,
} from 'lucide-react';
import { BrandLogo } from '@/components/layout/brand-logo';
import { cn } from '@/lib/utils';

const links = [
  { href: '/dashboard', label: 'Projects', icon: FolderKanban },
  { href: '/dashboard/history', label: 'History', icon: History },
  { href: '/dashboard/downloads', label: 'Downloads', icon: Download },
  { href: '/dashboard/connectors', label: 'Connectors', icon: Plug },
  { href: '/dashboard/extension', label: 'Extension', icon: Puzzle },
  { href: '/dashboard/api-keys', label: 'API Keys', icon: Key },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
  { href: '/dashboard/team', label: 'Team', icon: Users },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <aside className="sticky top-[57px] flex h-[calc(100vh-57px)] w-60 shrink-0 flex-col border-r border-border/50 glass p-4">
        <BrandLogo size="sm" className="mb-6 px-1" />
        <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Dashboard
        </p>
        <nav className="flex flex-1 flex-col gap-1">
          {links.map((l) => {
            const Icon = l.icon;
            const active = pathname === l.href || (l.href !== '/dashboard' && pathname.startsWith(l.href + '/'));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium no-underline transition-all',
                  active
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-muted-foreground hover:bg-primary/5 hover:text-primary',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg',
                    active ? 'bg-primary text-primary-foreground shadow-glow' : 'bg-secondary text-muted-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {l.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 p-6 md:p-8">{children}</div>
    </div>
  );
}
