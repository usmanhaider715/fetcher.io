import { Download, Globe, Image, Package, AlertTriangle, Clock, Search } from 'lucide-react';
import { cn, formatNumber, getPlatformLabel } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { BrandHeader } from '@/components/layout/brand-header';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  compact?: boolean;
}

function StatCard({ label, value, icon, variant = 'default', compact = false }: StatCardProps) {
  return (
    <Card className={cn('gradient-border min-w-0 overflow-hidden', !compact && 'transition-transform hover:scale-[1.02]')}>
      <CardContent className={cn('flex items-center gap-2', compact ? 'p-2' : 'gap-3 p-3')}>
        <div
          className={cn(
            'icon-3d shrink-0',
            compact ? 'h-8 w-8' : 'h-10 w-10',
            variant === 'default' && 'text-primary',
            variant === 'success' && 'text-success',
            variant === 'warning' && 'text-warning',
            variant === 'destructive' && 'text-destructive',
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('font-medium text-muted-foreground', compact ? 'text-[10px]' : 'text-[11px]')}>
            {label}
          </p>
          <p className={cn('truncate font-bold tabular-nums tracking-tight', compact ? 'text-base' : 'text-xl')}>
            {typeof value === 'number' ? formatNumber(value) : value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface DashboardStatsProps {
  currentUrl: string;
  detectedPlatform: string | null;
  productsFound: number;
  productsSaved: number;
  imagesDownloaded: number;
  imagesPending?: number;
  pagesDiscovered?: number;
  crawlMethod?: string;
  errors: number;
  sessionStatus: string;
  showHeader?: boolean;
  compact?: boolean;
  /** Optimized for 400px extension popup */
  popup?: boolean;
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'success' {
  if (status === 'running') return 'default';
  if (status === 'error') return 'destructive';
  if (status === 'completed') return 'success';
  return 'secondary';
}

export function DashboardStatsGrid({
  currentUrl,
  detectedPlatform,
  productsFound,
  productsSaved,
  imagesDownloaded,
  imagesPending = 0,
  pagesDiscovered,
  crawlMethod,
  errors,
  sessionStatus,
  showHeader = true,
  compact = false,
  popup = false,
}: DashboardStatsProps) {
  const displayUrl = currentUrl
    ? popup
      ? currentUrl.length > 38
        ? `${currentUrl.slice(0, 35)}...`
        : currentUrl
      : currentUrl.length > 45
        ? `${currentUrl.slice(0, 42)}...`
        : currentUrl
    : 'No active tab';

  const isCompact = compact || popup;

  return (
    <div className={cn('min-w-0', popup ? 'space-y-2' : 'space-y-3')}>
      {showHeader && (
        <BrandHeader
          status={sessionStatus}
          statusVariant={statusVariant(sessionStatus)}
          subtitle={compact ? undefined : 'Product Scraper'}
          compact={compact}
          minimal={popup}
        />
      )}

      <Card className="gradient-border min-w-0">
        <CardContent className={cn(popup ? 'space-y-2 p-2.5' : 'space-y-2.5 p-3')}>
          <div className="flex items-start gap-2">
            <div className={cn('icon-3d shrink-0 text-primary', popup ? 'h-7 w-7' : 'h-8 w-8')}>
              <Globe className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-muted-foreground">Current URL</p>
              <p className="break-all text-[11px] font-semibold leading-snug" title={currentUrl}>
                {displayUrl}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Platform</span>
            <Badge variant="outline" className="border-primary/20 bg-primary/5 px-1.5 py-0 text-[10px] text-primary">
              {getPlatformLabel(detectedPlatform)}
            </Badge>
          </div>
          {!popup && crawlMethod && pagesDiscovered !== undefined && pagesDiscovered > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Search className="h-3.5 w-3.5 text-primary" />
              Crawl ({crawlMethod}): {formatNumber(pagesDiscovered)} discovered
            </div>
          )}
        </CardContent>
      </Card>

      <div className={cn('grid min-w-0 gap-2', popup || !compact ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2')}>
        <StatCard label="Found" value={productsFound} icon={<Package className="h-3.5 w-3.5" />} compact={isCompact} />
        <StatCard label="Saved" value={productsSaved} icon={<Download className="h-3.5 w-3.5" />} variant="success" compact={isCompact} />
        <StatCard label="Images" value={imagesDownloaded} icon={<Image className="h-3.5 w-3.5" />} compact={isCompact} />
        <StatCard
          label="Pending"
          value={imagesPending}
          icon={<Clock className="h-3.5 w-3.5" />}
          variant={imagesPending > 0 ? 'warning' : 'default'}
          compact={isCompact}
        />
        <StatCard
          label="Errors"
          value={errors}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          variant={errors > 0 ? 'destructive' : 'default'}
          compact={isCompact}
        />
      </div>
    </div>
  );
}
