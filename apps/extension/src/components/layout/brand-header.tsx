import { APP_NAME } from '@fetcher/shared';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface BrandHeaderProps {
  status?: string;
  statusVariant?: 'default' | 'secondary' | 'destructive' | 'success';
  subtitle?: string;
  compact?: boolean;
  minimal?: boolean;
  className?: string;
}

function statusVariantFromStatus(status: string): BrandHeaderProps['statusVariant'] {
  if (status === 'running') return 'default';
  if (status === 'error') return 'destructive';
  if (status === 'completed') return 'success';
  return 'secondary';
}

export function BrandHeader({
  status,
  statusVariant,
  subtitle = 'Product Scraper',
  compact = false,
  minimal = false,
  className,
}: BrandHeaderProps) {
  const badgeVariant = statusVariant ?? (status ? statusVariantFromStatus(status) : 'secondary');

  return (
    <div className={cn('flex min-w-0 items-center justify-between gap-2', className)}>
      <div className="flex min-w-0 items-center gap-2">
        <div
          className={cn(
            'icon-3d shrink-0 bg-gradient-to-br from-primary to-purple-500 text-white shadow-glow',
            minimal ? 'h-8 w-8' : compact ? 'h-8 w-8' : 'h-10 w-10',
          )}
        >
          <Sparkles className={cn(minimal || compact ? 'h-3.5 w-3.5' : 'h-5 w-5')} />
        </div>
        <div className="min-w-0">
          <h1 className={cn('truncate font-bold tracking-tight', minimal ? 'text-sm' : compact ? 'text-sm' : 'text-base')}>
            {APP_NAME}
          </h1>
          {!minimal && (
            <p className="truncate text-[10px] text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {status && (
        <Badge variant={badgeVariant} className="shrink-0 capitalize text-[10px] shadow-sm">
          {status}
        </Badge>
      )}
    </div>
  );
}
