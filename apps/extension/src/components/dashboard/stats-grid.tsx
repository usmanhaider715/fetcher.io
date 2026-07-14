import { APP_NAME } from '@fetcher/shared';
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
}

function StatCard({ label, value, icon, variant = 'default' }: StatCardProps) {
  return (
    <Card className="gradient-border overflow-hidden transition-transform hover:scale-[1.02]">
      <CardContent className="flex items-center gap-3 p-3">
        <div
          className={cn(
            'icon-3d h-10 w-10 shrink-0',
            variant === 'default' && 'text-primary',
            variant === 'success' && 'text-success',
            variant === 'warning' && 'text-warning',
            variant === 'destructive' && 'text-destructive',
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-bold tabular-nums tracking-tight">
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
}: DashboardStatsProps) {
  const displayUrl = currentUrl
    ? currentUrl.length > 45
      ? `${currentUrl.slice(0, 42)}...`
      : currentUrl
    : 'No active tab';

  return (
    <div className="space-y-3">
      {showHeader && (
        <BrandHeader
          status={sessionStatus}
          statusVariant={statusVariant(sessionStatus)}
          subtitle={compact ? undefined : 'Product Scraper'}
          compact={compact}
        />
      )}

      <Card className="gradient-border">
        <CardContent className="space-y-2.5 p-3">
          <div className="flex items-start gap-2.5">
            <div className="icon-3d h-8 w-8 shrink-0 text-primary">
              <Globe className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground">Current URL</p>
              <p className="break-all text-xs font-semibold" title={currentUrl}>
                {displayUrl}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Platform</span>
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-xs text-primary">
              {getPlatformLabel(detectedPlatform)}
            </Badge>
          </div>
          {crawlMethod && pagesDiscovered !== undefined && pagesDiscovered > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Search className="h-3.5 w-3.5 text-primary" />
              Crawl ({crawlMethod}): {formatNumber(pagesDiscovered)} discovered
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Products Found" value={productsFound} icon={<Package className="h-4 w-4" />} />
        <StatCard
          label="Products Saved"
          value={productsSaved}
          icon={<Download className="h-4 w-4" />}
          variant="success"
        />
        <StatCard label="Images" value={imagesDownloaded} icon={<Image className="h-4 w-4" />} />
        <StatCard
          label="Pending"
          value={imagesPending}
          icon={<Clock className="h-4 w-4" />}
          variant={imagesPending > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Errors"
          value={errors}
          icon={<AlertTriangle className="h-4 w-4" />}
          variant={errors > 0 ? 'destructive' : 'default'}
        />
      </div>
    </div>
  );
}

export function DashboardStatsCompact(props: DashboardStatsProps) {
  return (
    <DashboardStatsGrid {...props} showHeader={false} compact />
  );
}
