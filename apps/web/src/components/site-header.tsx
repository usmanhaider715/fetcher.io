import Link from 'next/link';

const nav = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/docs', label: 'Docs' },
  { href: '/blog', label: 'Blog' },
  { href: '/support', label: 'Support' },
];

export function SiteHeader() {
  return (
    <header className="border-b border-white/10 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-bold no-underline">
          Fetcher.io
        </Link>
        <nav className="hidden gap-6 md:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-zinc-300 no-underline hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex gap-3">
          <Link href="/login" className="rounded-lg px-3 py-2 text-sm text-zinc-300 no-underline hover:text-white">
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-violet-500"
          >
            Start free
          </Link>
        </div>
      </div>
    </header>
  );
}
