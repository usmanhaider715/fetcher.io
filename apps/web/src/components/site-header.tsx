import Link from 'next/link';
import { BrandLogo } from '@/components/layout/brand-logo';

const nav = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/docs', label: 'Docs' },
  { href: '/blog', label: 'Blog' },
  { href: '/support', label: 'Support' },
];

export function SiteHeader() {
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
          <Link
            href="/login"
            className="rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground no-underline transition-colors hover:text-primary"
          >
            Log in
          </Link>
          <Link href="/register" className="btn-primary px-4 py-2 text-sm">
            Start free
          </Link>
        </div>
      </div>
    </header>
  );
}
