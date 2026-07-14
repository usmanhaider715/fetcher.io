import type { LogEntry } from '@fetcher/shared';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LogsPanelProps {
  logs: LogEntry[];
  maxHeight?: string;
}

const levelConfig = {
  error: { icon: XCircle, variant: 'destructive' as const, color: 'text-destructive' },
  warning: { icon: AlertTriangle, variant: 'warning' as const, color: 'text-warning' },
  info: { icon: Info, variant: 'secondary' as const, color: 'text-muted-foreground' },
  success: { icon: CheckCircle2, variant: 'success' as const, color: 'text-success' },
};

export function LogsPanel({ logs, maxHeight = '160px' }: LogsPanelProps) {
  return (
    <Card className="gradient-border">
      <CardHeader className="p-3 pb-0">
        <CardTitle className="text-sm">Logs</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-2">
        <ScrollArea style={{ height: maxHeight }}>
          {logs.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No logs yet</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const config = levelConfig[log.level];
                const Icon = config.icon;
                const time = new Date(log.timestamp).toLocaleTimeString();

                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 rounded-lg bg-secondary/50 p-2 text-xs"
                  >
                    <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', config.color)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={config.variant} className="px-1.5 py-0 text-[10px]">
                          {log.level}
                        </Badge>
                        <span className="text-muted-foreground">{time}</span>
                      </div>
                      <p className="mt-0.5 break-words">{log.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
