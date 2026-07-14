import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  APP_NAME,
  DEFAULT_CLOUD_API_URL,
  DEFAULT_SETTINGS,
  PRODUCT_ID_FORMATS,
  THEME_MODES,
  type AppSettings,
} from '@fetcher/shared';
import {
  Brain,
  Cloud,
  Copy,
  Image,
  RotateCcw,
  Save,
  Settings2,
  Store,
} from 'lucide-react';
import { AppProviders } from '@/components/app-providers';
import { BrandHeader } from '@/components/layout/brand-header';
import { PremiumBackground } from '@/components/layout/premium-background';
import { SidebarNav, type NavItem } from '@/components/layout/sidebar-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { sendMessage } from '@/lib/messaging';
import '@/styles/globals.css';

const NAV_ITEMS: NavItem[] = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'scraping', label: 'Scraping', icon: Copy },
  { id: 'ai', label: 'AI Enrichment', icon: Brain },
  { id: 'connectors', label: 'Connectors', icon: Store },
  { id: 'products', label: 'Products & Images', icon: Image },
  { id: 'cloud', label: 'Cloud Sync', icon: Cloud },
];

const settingsSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']),
  backendUrl: z.string().url(),
  cloudApiUrl: z.string().url().optional().or(z.literal('')),
  licenseKey: z.string().optional(),
  cloudAccessToken: z.string().optional(),
  productsFolder: z.string().min(1),
  concurrentDownloads: z.coerce.number().min(1).max(20),
  asyncImageDownloads: z.boolean(),
  retryCount: z.coerce.number().min(0).max(10),
  delayMs: z.coerce.number().min(0).max(60000),
  randomizeDelay: z.boolean(),
  productIdFormat: z.enum(['category_based', 'uuid']),
  compressionEnabled: z.boolean(),
  resizeImages: z.boolean(),
  maxImageWidth: z.coerce.number().min(100).max(4096),
  createThumbnails: z.boolean(),
  autoResume: z.boolean(),
  dupSku: z.boolean(),
  dupUrl: z.boolean(),
  dupHash: z.boolean(),
  dupImageHash: z.boolean(),
  dupTitleSimilarity: z.boolean(),
  aiEnrichmentEnabled: z.boolean(),
  openAiApiKey: z.string().optional(),
  shopifyStoreUrl: z.string().optional(),
  shopifyAccessToken: z.string().optional(),
  wooStoreUrl: z.string().optional(),
  wooConsumerKey: z.string().optional(),
  wooConsumerSecret: z.string().optional(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

function settingsToForm(settings: AppSettings): SettingsFormData {
  return {
    theme: settings.theme,
    backendUrl: settings.backendUrl,
    cloudApiUrl: settings.cloudApiUrl ?? DEFAULT_CLOUD_API_URL,
    licenseKey: settings.licenseKey ?? '',
    cloudAccessToken: settings.accessToken ?? '',
    productsFolder: settings.productsFolder,
    concurrentDownloads: settings.concurrentDownloads,
    asyncImageDownloads: settings.asyncImageDownloads ?? true,
    retryCount: settings.retryCount,
    delayMs: settings.delayMs,
    randomizeDelay: settings.randomizeDelay,
    productIdFormat: settings.productIdFormat,
    compressionEnabled: settings.compressionEnabled,
    resizeImages: settings.resizeImages,
    maxImageWidth: settings.maxImageWidth,
    createThumbnails: settings.createThumbnails,
    autoResume: settings.autoResume,
    dupSku: settings.duplicateDetection.sku,
    dupUrl: settings.duplicateDetection.url,
    dupHash: settings.duplicateDetection.hash,
    dupImageHash: settings.duplicateDetection.imageHash,
    dupTitleSimilarity: settings.duplicateDetection.titleSimilarity,
    aiEnrichmentEnabled: settings.aiEnrichmentEnabled ?? false,
    openAiApiKey: settings.openAiApiKey ?? '',
    shopifyStoreUrl: settings.connectors?.shopify?.storeUrl ?? '',
    shopifyAccessToken: settings.connectors?.shopify?.accessToken ?? '',
    wooStoreUrl: settings.connectors?.woocommerce?.storeUrl ?? '',
    wooConsumerKey: settings.connectors?.woocommerce?.consumerKey ?? '',
    wooConsumerSecret: settings.connectors?.woocommerce?.consumerSecret ?? '',
  };
}

function formToSettings(data: SettingsFormData): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    theme: data.theme,
    backendUrl: data.backendUrl,
    cloudApiUrl: data.cloudApiUrl || DEFAULT_CLOUD_API_URL,
    licenseKey: data.licenseKey || undefined,
    accessToken: data.cloudAccessToken || undefined,
    productsFolder: data.productsFolder,
    concurrentDownloads: data.concurrentDownloads,
    asyncImageDownloads: data.asyncImageDownloads,
    retryCount: data.retryCount,
    delayMs: data.delayMs,
    randomizeDelay: data.randomizeDelay,
    productIdFormat: data.productIdFormat,
    compressionEnabled: data.compressionEnabled,
    resizeImages: data.resizeImages,
    maxImageWidth: data.maxImageWidth,
    createThumbnails: data.createThumbnails,
    autoResume: data.autoResume,
    duplicateDetection: {
      sku: data.dupSku,
      url: data.dupUrl,
      hash: data.dupHash,
      imageHash: data.dupImageHash,
      titleSimilarity: data.dupTitleSimilarity,
    },
    aiEnrichmentEnabled: data.aiEnrichmentEnabled,
    openAiApiKey: data.openAiApiKey || undefined,
    connectors: {
      shopify:
        data.shopifyStoreUrl && data.shopifyAccessToken
          ? { storeUrl: data.shopifyStoreUrl, accessToken: data.shopifyAccessToken }
          : undefined,
      woocommerce:
        data.wooStoreUrl && data.wooConsumerKey && data.wooConsumerSecret
          ? {
              storeUrl: data.wooStoreUrl,
              consumerKey: data.wooConsumerKey,
              consumerSecret: data.wooConsumerSecret,
            }
          : undefined,
    },
  };
}

function SettingsField({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-center">
      <div>
        <label className="text-sm font-semibold">{label}</label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function OptionsPage() {
  const [activeNav, setActiveNav] = useState('general');
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settingsToForm(DEFAULT_SETTINGS),
  });

  useEffect(() => {
    sendMessage<undefined, AppSettings>({ type: 'GET_SETTINGS' }).then((settings) => {
      reset(settingsToForm(settings));
    });
  }, [reset]);

  const onSubmit = useCallback(
    async (data: SettingsFormData) => {
      const payload = formToSettings(data);
      await sendMessage({ type: 'UPDATE_SETTINGS', payload });
      reset(data);
    },
    [reset],
  );

  const handleReset = useCallback(() => {
    reset(settingsToForm(DEFAULT_SETTINGS));
  }, [reset]);

  const inputClass = 'input-premium';
  const checkClass = 'h-4 w-4 rounded border-input accent-primary';

  const sections: Record<string, React.ReactNode> = {
    general: (
      <Card className="gradient-border">
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Appearance and connection settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingsField label="Theme">
            <select {...register('theme')} className={inputClass}>
              {THEME_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>{mode.label}</option>
              ))}
            </select>
          </SettingsField>
          <SettingsField label="Backend URL" description="Local scrape API (default :3847)">
            <input {...register('backendUrl')} type="url" className={inputClass} />
          </SettingsField>
          <SettingsField label="Products Folder">
            <input {...register('productsFolder')} type="text" className={inputClass} />
          </SettingsField>
        </CardContent>
      </Card>
    ),
    scraping: (
      <>
        <Card className="gradient-border">
          <CardHeader><CardTitle>Scraping</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <SettingsField label="Concurrent Downloads">
              <input {...register('concurrentDownloads')} type="number" min={1} max={20} className={inputClass} />
            </SettingsField>
            <SettingsField label="Async Image Downloads">
              <input {...register('asyncImageDownloads')} type="checkbox" className={checkClass} />
            </SettingsField>
            <SettingsField label="Retry Count">
              <input {...register('retryCount')} type="number" min={0} max={10} className={inputClass} />
            </SettingsField>
            <SettingsField label="Delay (ms)">
              <input {...register('delayMs')} type="number" min={0} className={inputClass} />
            </SettingsField>
            <SettingsField label="Randomize Delay">
              <input {...register('randomizeDelay')} type="checkbox" className={checkClass} />
            </SettingsField>
            <SettingsField label="Auto Resume">
              <input {...register('autoResume')} type="checkbox" className={checkClass} />
            </SettingsField>
          </CardContent>
        </Card>
        <Card className="gradient-border">
          <CardHeader>
            <CardTitle>Duplicate Detection</CardTitle>
            <CardDescription>Skip products already saved in the same session</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(
              [
                ['dupSku', 'Match by SKU'],
                ['dupUrl', 'Match by product URL'],
                ['dupHash', 'Match by content hash'],
                ['dupImageHash', 'Match by primary image URL'],
                ['dupTitleSimilarity', 'Fuzzy title similarity (85%)'],
              ] as const
            ).map(([field, label]) => (
              <SettingsField key={field} label={label}>
                <input {...register(field)} type="checkbox" className={checkClass} />
              </SettingsField>
            ))}
          </CardContent>
        </Card>
      </>
    ),
    ai: (
      <Card className="gradient-border">
        <CardHeader>
          <CardTitle>AI Enrichment</CardTitle>
          <CardDescription>Auto-generate summaries and SEO fields on save</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingsField label="Enable AI Enrichment">
            <input {...register('aiEnrichmentEnabled')} type="checkbox" className={checkClass} />
          </SettingsField>
          <SettingsField label="OpenAI API Key">
            <input {...register('openAiApiKey')} type="password" placeholder="sk-..." className={inputClass} />
          </SettingsField>
        </CardContent>
      </Card>
    ),
    connectors: (
      <Card className="gradient-border">
        <CardHeader>
          <CardTitle>Store Connectors</CardTitle>
          <CardDescription>Push scraped products to your store</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingsField label="Shopify Store URL">
            <input {...register('shopifyStoreUrl')} type="url" placeholder="https://your-store.myshopify.com" className={inputClass} />
          </SettingsField>
          <SettingsField label="Shopify Access Token">
            <input {...register('shopifyAccessToken')} type="password" className={inputClass} />
          </SettingsField>
          <Separator />
          <SettingsField label="WooCommerce Store URL">
            <input {...register('wooStoreUrl')} type="url" placeholder="https://your-store.com" className={inputClass} />
          </SettingsField>
          <SettingsField label="WooCommerce Consumer Key">
            <input {...register('wooConsumerKey')} type="text" className={inputClass} />
          </SettingsField>
          <SettingsField label="WooCommerce Consumer Secret">
            <input {...register('wooConsumerSecret')} type="password" className={inputClass} />
          </SettingsField>
        </CardContent>
      </Card>
    ),
    products: (
      <Card className="gradient-border">
        <CardHeader><CardTitle>Products & Images</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <SettingsField label="Product ID Format">
            <select {...register('productIdFormat')} className={inputClass}>
              {PRODUCT_ID_FORMATS.map((format) => (
                <option key={format.value} value={format.value}>{format.label}</option>
              ))}
            </select>
          </SettingsField>
          <SettingsField label="Compress Images">
            <input {...register('compressionEnabled')} type="checkbox" className={checkClass} />
          </SettingsField>
          <SettingsField label="Resize Images">
            <input {...register('resizeImages')} type="checkbox" className={checkClass} />
          </SettingsField>
          <SettingsField label="Max Image Width">
            <input {...register('maxImageWidth')} type="number" min={100} max={4096} className={inputClass} />
          </SettingsField>
          <SettingsField label="Create Thumbnails">
            <input {...register('createThumbnails')} type="checkbox" className={checkClass} />
          </SettingsField>
        </CardContent>
      </Card>
    ),
    cloud: (
      <Card className="gradient-border">
        <CardHeader>
          <CardTitle>Cloud Sync</CardTitle>
          <CardDescription>Connect to Fetcher.io cloud for billing, AI, and sync</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingsField label="Cloud API URL" description="Production: https://api.productfetcher.online">
            <input {...register('cloudApiUrl')} type="url" placeholder={DEFAULT_CLOUD_API_URL} className={inputClass} />
          </SettingsField>
          <SettingsField label="License Key" description="From dashboard after signup">
            <input {...register('licenseKey')} type="text" className={inputClass} />
          </SettingsField>
          <SettingsField label="Cloud Access Token" description="Optional — from web login">
            <input {...register('cloudAccessToken')} type="password" className={inputClass} />
          </SettingsField>
        </CardContent>
      </Card>
    ),
  };

  return (
    <div className="premium-bg relative min-h-screen">
      <PremiumBackground />
      <div className="relative z-10 flex min-h-screen">
        <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-border/50 glass p-4">
          <BrandHeader subtitle="Settings" className="mb-6" />
          <SidebarNav items={NAV_ITEMS} activeId={activeNav} onChange={setActiveNav} />
        </aside>

        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border/50 glass px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">
                  {NAV_ITEMS.find((n) => n.id === activeNav)?.label ?? 'Settings'}
                </h2>
                <p className="text-sm text-muted-foreground">{APP_NAME} configuration</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
                <Button
                  type="submit"
                  form="settings-form"
                  size="sm"
                  disabled={isSubmitting || !isDirty}
                >
                  <Save className="h-4 w-4" />
                  Save
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 p-8">
            <form id="settings-form" onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-3xl space-y-6">
              {sections[activeNav]}
            </form>
          </main>
        </div>
      </div>
    </div>
  );
}

export function OptionsApp() {
  return (
    <AppProviders theme="light">
      <OptionsPage />
    </AppProviders>
  );
}
