import { useState } from 'react';
import { Download, FileJson, FileSpreadsheet, FileText, Archive, Trash2 } from 'lucide-react';
import type { ExportFormat } from '@fetcher/shared';
import { sendMessage } from '@/lib/messaging';
import { useBackendReady } from '@/hooks/use-backend';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboardStore } from '@/stores/dashboard-store';

const formats: Array<{ value: ExportFormat; label: string; icon: React.ReactNode }> = [
  { value: 'json', label: 'JSON', icon: <FileJson className="h-3.5 w-3.5" /> },
  { value: 'csv', label: 'CSV', icon: <FileSpreadsheet className="h-3.5 w-3.5" /> },
  { value: 'excel', label: 'Excel', icon: <FileSpreadsheet className="h-3.5 w-3.5" /> },
  { value: 'txt', label: 'TXT', icon: <FileText className="h-3.5 w-3.5" /> },
  { value: 'zip', label: 'ZIP', icon: <Archive className="h-3.5 w-3.5" /> },
];

export function ExportPanel() {
  const sessionId = useDashboardStore((s) => s.stats.sessionId);
  const productsSaved = useDashboardStore((s) => s.stats.productsSaved);
  const { ready, cloud } = useBackendReady();
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(null);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [purging, setPurging] = useState(false);

  const handleExport = async (format: ExportFormat) => {
    setExporting(format);
    setLastExport(null);
    try {
      const result = await sendMessage<
        { format: ExportFormat; sessionId?: string },
        { success?: boolean; count?: number; filename?: string; error?: string; note?: string }
      >({
        type: 'EXPORT_AND_DOWNLOAD',
        payload: { format, sessionId },
      });

      if (result.error) {
        setLastExport(result.error);
        return;
      }

      if (!result.count || !result.filename) {
        setLastExport('Export empty — scrape some products first, then try again.');
        return;
      }

      setLastExport(
        result.note ??
          `Downloaded ${result.count} products as ${result.filename}. Images are in Downloads/fetcher-io.`,
      );
      setShowPurgeConfirm(true);
    } catch (error) {
      setLastExport(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const handlePurge = async () => {
    setPurging(true);
    try {
      await sendMessage({ type: 'PURGE_SESSION' });
      setLastExport('Local session cleared. Full run details stay on your dashboard until you delete them.');
      setShowPurgeConfirm(false);
    } catch (error) {
      setLastExport(error instanceof Error ? error.message : 'Cleanup failed');
    } finally {
      setPurging(false);
    }
  };

  return (
    <Card className="gradient-border">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Download className="h-4 w-4" />
          Download run data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {cloud ? (
          <p className="text-[10px] text-muted-foreground">
            Signed in — product details sync to your dashboard. Images download to your computer (not the server).
          </p>
        ) : !ready ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] text-amber-800">
            Sign in to save runs to the cloud, or run <code className="font-mono">pnpm dev:backend</code> for
            offline local saves.
          </p>
        ) : null}

        <p className="text-[10px] text-muted-foreground">
          {sessionId
            ? `${productsSaved} products in current run — export metadata, images already in Downloads`
            : 'Start a scrape session to export products'}
        </p>

        <div className="grid grid-cols-3 gap-1.5">
          {formats.map((f) => (
            <Button
              key={f.value}
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={!sessionId || exporting !== null || !ready}
              onClick={() => handleExport(f.value)}
            >
              {f.icon}
              {f.label}
            </Button>
          ))}
        </div>

        {lastExport && (
          <p className="text-center text-[10px] text-muted-foreground">{lastExport}</p>
        )}

        {showPurgeConfirm && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
            <p className="text-[10px] font-medium text-destructive">
              Download complete. Clear this extension session? Dashboard history keeps full product details until you delete the run there.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                className="flex-1 text-xs"
                disabled={purging}
                onClick={handlePurge}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {purging ? 'Clearing…' : 'Clear session'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => setShowPurgeConfirm(false)}
              >
                Keep
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
