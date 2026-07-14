import { useRef, useState } from 'react';
import { FileSpreadsheet, Link2 } from 'lucide-react';
import { parseUrlsFromCsv, parseUrlsFromText } from '@/lib/parse-csv';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface UrlImportPanelProps {
  mode: 'import_csv' | 'selected_urls';
  urls: string[];
  onChange: (urls: string[]) => void;
}

export function UrlImportPanel({ mode, urls, onChange }: UrlImportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [textInput, setTextInput] = useState('');

  const handleFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseUrlsFromCsv(text);
    onChange(parsed);
  };

  const handleAddText = () => {
    const parsed = parseUrlsFromText(textInput);
    const merged = [...new Set([...urls, ...parsed])];
    onChange(merged);
    setTextInput('');
  };

  return (
    <Card className="gradient-border">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {mode === 'import_csv' ? (
            <FileSpreadsheet className="h-4 w-4" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          {mode === 'import_csv' ? 'Import CSV' : 'Selected URLs'}
        </CardTitle>
        <CardDescription className="text-xs">
          {mode === 'import_csv'
            ? 'Upload a CSV with product URLs (one per row or a url column)'
            : 'Paste product URLs, one per line'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {mode === 'import_csv' && (
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose CSV File
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onChange([])} disabled={urls.length === 0}>
              Clear
            </Button>
          </div>
        )}

        {mode === 'selected_urls' && (
          <div className="space-y-2">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="https://example.com/product/1&#10;https://example.com/product/2"
              className="min-h-[80px] w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={handleAddText} disabled={!textInput.trim()}>
                Add URLs
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onChange([])} disabled={urls.length === 0}>
                Clear
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">URLs loaded</span>
          <Badge variant="secondary">{urls.length}</Badge>
        </div>

        {urls.length > 0 && (
          <div className="max-h-24 overflow-y-auto rounded-md border border-border bg-secondary/20 p-2">
            {urls.slice(0, 5).map((url) => (
              <p key={url} className="truncate text-[10px] text-muted-foreground" title={url}>
                {url}
              </p>
            ))}
            {urls.length > 5 && (
              <p className="text-[10px] text-muted-foreground">+{urls.length - 5} more</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
