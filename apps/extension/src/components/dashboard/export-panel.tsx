import { useState } from 'react';
import { Download, FileJson, FileSpreadsheet, FileText, Archive } from 'lucide-react';
import type { ExportFormat } from '@fetcher/shared';
import { backendApi } from '@/lib/backend-api';
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
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setExporting(format);
    try {
      const result = await backendApi.export(format, sessionId);
      const scope = sessionId ? 'current session' : 'all products';
      setLastExport(`${result.count} products (${scope}) → ${result.path.split('/').pop()}`);
    } catch {
      setLastExport('Export failed — is backend running?');
    } finally {
      setExporting(null);
    }
  };

  return (
    <Card className="gradient-border">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Download className="h-4 w-4" />
          Export
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="mb-2 text-[10px] text-muted-foreground">
          {sessionId ? 'Exporting current session only' : 'No active session — exports all products'}
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {formats.map((f) => (
            <Button
              key={f.value}
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={exporting !== null}
              onClick={() => handleExport(f.value)}
            >
              {f.icon}
              {f.label}
            </Button>
          ))}
        </div>
        {lastExport && (
          <p className="mt-2 text-center text-[10px] text-muted-foreground">{lastExport}</p>
        )}
      </CardContent>
    </Card>
  );
}
