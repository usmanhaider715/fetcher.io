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
}

export function SidebarNav({ items, activeId, onChange, vertical = true }: SidebarNavProps) {
  return (
    <nav
      className={cn(
        'flex gap-1',
        vertical ? 'flex-col' : 'flex-row overflow-x-auto',
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-200',
              vertical ? 'w-full' : 'shrink-0',
              isActive
                ? 'nav-item-active shadow-premium'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-glow'
                  : 'bg-secondary/80 text-muted-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
