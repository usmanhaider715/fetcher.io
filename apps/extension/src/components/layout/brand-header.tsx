import { APP_NAME } from '@fetcher/shared';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface BrandHeaderProps {
  status?: string;
  statusVariant?: 'default' | 'secondary' | 'destructive' | 'success';
  subtitle?: string;
  compact?: boolean;
  className?: string;
}

export function BrandHeader({
  status,
  statusVariant = 'secondary',
  subtitle = 'Product Scraper',
  compact = false,
  className,
}: BrandHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'icon-3d shrink-0 bg-gradient-to-br from-primary to-purple-500 text-white shadow-glow',
            compact ? 'h-9 w-9' : 'h-10 w-10',
          )}
        >
          <Sparkles className={cn(compact ? 'h-4 w-4' : 'h-5 w-5')} />
        </div>
        <div>
          <h1 className={cn('font-bold tracking-tight', compact ? 'text-sm' : 'text-base')}>
            {APP_NAME}
          </h1>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {status && (
        <Badge variant={statusVariant} className="capitalize shadow-sm">
          {status}
        </Badge>
      )}
    </div>
  );
}
