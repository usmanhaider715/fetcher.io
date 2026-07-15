import { APP_NAME } from '@fetcher/shared';
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

const ICON_URL = chrome.runtime.getURL('public/icons/icon-48.png');

export function BrandHeader({
  status,
  statusVariant,
  subtitle = 'Product Scraper',
  compact = false,
  minimal = false,
  className,
}: BrandHeaderProps) {
  const badgeVariant = statusVariant ?? (status ? statusVariantFromStatus(status) : 'secondary');
  const iconSize = minimal || compact ? 32 : 40;

  return (
    <div className={cn('flex min-w-0 items-center justify-between gap-2', className)}>
      <div className="flex min-w-0 items-center gap-2">
        <img
          src={ICON_URL}
          alt=""
          width={iconSize}
          height={iconSize}
          className="shrink-0"
        />
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
