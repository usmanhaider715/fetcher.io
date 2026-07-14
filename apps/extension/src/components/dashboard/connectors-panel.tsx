import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plug, ShoppingBag, Store } from 'lucide-react';
import { backendApi } from '@/lib/backend-api';
import { useDashboardStore } from '@/stores/dashboard-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function ConnectorsPanel() {
  const sessionId = useDashboardStore((s) => s.stats.sessionId);
  const productsSaved = useDashboardStore((s) => s.stats.productsSaved);
  const [pushing, setPushing] = useState<'shopify' | 'woocommerce' | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const { data: status } = useQuery({
    queryKey: ['connector-status'],
    queryFn: () => backendApi.getConnectorStatus(),
    retry: false,
    refetchInterval: 10000,
  });

  const handlePush = async (platform: 'shopify' | 'woocommerce') => {
    if (!sessionId) {
      setResult('Start a scrape session first');
      return;
    }
    setPushing(platform);
    setResult(null);
    try {
      const res =
        platform === 'shopify'
          ? await backendApi.pushSessionToShopify(sessionId)
          : await backendApi.pushSessionToWooCommerce(sessionId);
      setResult(`${res.pushed}/${res.total} pushed to ${platform}${res.failed ? ` (${res.failed} failed)` : ''}`);
    } catch (error) {
      setResult(error instanceof Error ? error.message : 'Push failed');
    } finally {
      setPushing(null);
    }
  };

  return (
    <Card className="gradient-border">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Plug className="h-4 w-4" />
          Store Connectors
        </CardTitle>
        <CardDescription className="text-xs">
          Push saved products to Shopify or WooCommerce
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <div className="flex gap-2">
          <Badge variant={status?.shopify?.configured ? 'success' : 'secondary'} className="text-[10px]">
            Shopify {status?.shopify?.configured ? 'ready' : 'not configured'}
          </Badge>
          <Badge variant={status?.woocommerce?.configured ? 'success' : 'secondary'} className="text-[10px]">
            Woo {status?.woocommerce?.configured ? 'ready' : 'not configured'}
          </Badge>
        </div>

        {!sessionId && (
          <p className="text-xs text-muted-foreground">No active session — start scraping to push products</p>
        )}

        {sessionId && (
          <p className="text-xs text-muted-foreground">{productsSaved} products saved in current session</p>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs"
            disabled={!sessionId || pushing !== null || !status?.shopify?.configured}
            onClick={() => handlePush('shopify')}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            Push to Shopify
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs"
            disabled={!sessionId || pushing !== null || !status?.woocommerce?.configured}
            onClick={() => handlePush('woocommerce')}
          >
            <Store className="h-3.5 w-3.5" />
            Push to Woo
          </Button>
        </div>

        {result && <p className="text-center text-[10px] text-muted-foreground">{result}</p>}
        <p className="text-[10px] text-muted-foreground">
          Configure API credentials in Settings → Connectors
        </p>
      </CardContent>
    </Card>
  );
}
