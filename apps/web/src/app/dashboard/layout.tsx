import Link from 'next/link';

const links = [
  { href: '/dashboard', label: 'Projects', icon: '📁' },
  { href: '/dashboard/history', label: 'History', icon: '🕐' },
  { href: '/dashboard/downloads', label: 'Downloads', icon: '⬇️' },
  { href: '/dashboard/connectors', label: 'Connectors', icon: '🔌' },
  { href: '/dashboard/api-keys', label: 'API Keys', icon: '🔑' },
  { href: '/dashboard/billing', label: 'Billing', icon: '💳' },
  { href: '/dashboard/team', label: 'Team', icon: '👥' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-8rem)]">
      <aside className="w-56 shrink-0 border-r border-white/10 bg-card p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted">Dashboard</p>
        <nav className="space-y-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-300 no-underline hover:bg-white/5 hover:text-white"
            >
              <span>{l.icon}</span> {l.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1 p-8">{children}</div>
    </div>
  );
}
