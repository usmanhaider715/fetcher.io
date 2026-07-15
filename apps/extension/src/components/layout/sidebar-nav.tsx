import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface SidebarNavProps {
  items: NavItem[];
  activeId: string;
  onChange: (id: string) => void;
  vertical?: boolean;
  compact?: boolean;
}

export function SidebarNav({
  items,
  activeId,
  onChange,
  vertical = true,
  compact = false,
}: SidebarNavProps) {
  return (
    <nav
      className={cn(
        'flex gap-0.5',
        vertical ? 'flex-col' : 'flex-row overflow-x-auto',
        compact && 'items-center',
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            title={item.label}
            onClick={() => onChange(item.id)}
            className={cn(
              'flex items-center rounded-xl text-left text-sm font-medium transition-all duration-200',
              compact
                ? 'h-10 w-10 shrink-0 justify-center p-0'
                : 'gap-2.5 px-3 py-2.5',
              vertical && !compact && 'w-full',
              !vertical && 'shrink-0',
              isActive
                ? 'nav-item-active shadow-premium'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'flex shrink-0 items-center justify-center rounded-lg transition-colors',
                compact ? 'h-9 w-9' : 'h-8 w-8',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-glow'
                  : 'bg-secondary/80 text-muted-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            {!compact && <span className="truncate">{item.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}
