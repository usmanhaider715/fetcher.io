import { APP_NAME } from '@fetcher/shared';
import { Download, Globe, Image, Package, AlertTriangle, Clock, Search } from 'lucide-react';
import { cn, formatNumber, getPlatformLabel } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

function StatCard({ label, value, icon, variant = 'default' }: StatCardProps) {
  return (
    <Card className="gradient-border">
      <CardContent className="flex items-center gap-3 p-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            variant === 'default' && 'bg-primary/10 text-primary',
            variant === 'success' && 'bg-success/10 text-success',
            variant === 'warning' && 'bg-warning/10 text-warning',
            variant === 'destructive' && 'bg-destructive/10 text-destructive',
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-semibold tabular-nums">
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
}: DashboardStatsProps) {
  const displayUrl = currentUrl
    ? currentUrl.length > 45
      ? `${currentUrl.slice(0, 42)}...`
      : currentUrl
    : 'No active tab';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Package className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold">{APP_NAME}</h1>
            <p className="text-xs text-muted-foreground">Product Scraper</p>
          </div>
        </div>
        <Badge
          variant={
            sessionStatus === 'running'
              ? 'default'
              : sessionStatus === 'error'
                ? 'destructive'
                : sessionStatus === 'completed'
                  ? 'success'
                  : 'secondary'
          }
          className="capitalize"
        >
          {sessionStatus}
        </Badge>
      </div>

      <Card className="gradient-border">
        <CardContent className="space-y-2 p-3">
          <div className="flex items-start gap-2">
            <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Current URL</p>
              <p className="break-all text-xs font-medium" title={currentUrl}>
                {displayUrl}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Platform:</span>
            <Badge variant="outline" className="text-xs">
              {getPlatformLabel(detectedPlatform)}
            </Badge>
          </div>
          {crawlMethod && pagesDiscovered !== undefined && pagesDiscovered > 0 && (
            <div className="flex items-center gap-2">
              <Search className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Crawl ({crawlMethod}): {formatNumber(pagesDiscovered)} discovered
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Products Found"
          value={productsFound}
          icon={<Package className="h-4 w-4" />}
        />
        <StatCard
          label="Products Saved"
          value={productsSaved}
          icon={<Download className="h-4 w-4" />}
          variant="success"
        />
        <StatCard
          label="Images Downloaded"
          value={imagesDownloaded}
          icon={<Image className="h-4 w-4" />}
        />
        <StatCard
          label="Images Pending"
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
