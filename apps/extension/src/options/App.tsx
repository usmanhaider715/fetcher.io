import { useCallback, useEffect } from 'react';
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
import { Save, RotateCcw } from 'lucide-react';
import { AppProviders } from '@/components/app-providers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { sendMessage } from '@/lib/messaging';
import '@/styles/globals.css';

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
    <div className="grid gap-2 sm:grid-cols-[200px_1fr] sm:items-center">
      <div>
        <label className="text-sm font-medium">{label}</label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function OptionsPage() {
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

  const inputClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm';
  const checkClass = 'h-4 w-4 rounded border-input';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b glass sticky top-0 z-10">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold">{APP_NAME} Settings</h1>
            <p className="text-sm text-muted-foreground">Configure scraping and storage preferences</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card className="gradient-border">
            <CardHeader>
              <CardTitle>General</CardTitle>
              <CardDescription>Appearance and connection settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SettingsField label="Theme">
                <select {...register('theme')} className={inputClass}>
                  {THEME_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </select>
              </SettingsField>
              <SettingsField label="Backend URL" description="Local scrape API (default :3847)">
                <input {...register('backendUrl')} type="url" className={inputClass} />
              </SettingsField>
              <SettingsField label="Cloud API URL" description="Production: https://api.fetcherio.dev">
                <input {...register('cloudApiUrl')} type="url" placeholder={DEFAULT_CLOUD_API_URL} className={inputClass} />
              </SettingsField>
              <SettingsField label="License Key" description="From dashboard after signup">
                <input {...register('licenseKey')} type="text" className={inputClass} />
              </SettingsField>
              <SettingsField label="Cloud Access Token" description="Optional — from web login for AI/billing sync">
                <input {...register('cloudAccessToken')} type="password" className={inputClass} />
              </SettingsField>
              <SettingsField label="Products Folder">
                <input {...register('productsFolder')} type="text" className={inputClass} />
              </SettingsField>
            </CardContent>
          </Card>

          <Card className="gradient-border">
            <CardHeader>
              <CardTitle>Scraping</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SettingsField label="Concurrent Downloads">
                <input {...register('concurrentDownloads')} type="number" min={1} max={20} className={inputClass} />
              </SettingsField>
              <SettingsField label="Async Image Downloads" description="Save metadata first, download images in background">
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

          <Card className="gradient-border">
            <CardHeader>
              <CardTitle>Products & Images</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SettingsField label="Product ID Format">
                <select {...register('productIdFormat')} className={inputClass}>
                  {PRODUCT_ID_FORMATS.map((format) => (
                    <option key={format.value} value={format.value}>
                      {format.label}
                    </option>
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

          <Separator />

          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
              Reset Defaults
            </Button>
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              <Save className="h-4 w-4" />
              Save Settings
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

export function OptionsApp() {
  return (
    <AppProviders>
      <OptionsPage />
    </AppProviders>
  );
}
