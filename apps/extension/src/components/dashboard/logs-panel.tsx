import type { LogEntry } from '@fetcher/shared';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LogsPanelProps {
  logs: LogEntry[];
  maxHeight?: string;
  compact?: boolean;
}

const levelConfig = {
  error: { icon: XCircle, variant: 'destructive' as const, color: 'text-destructive' },
  warning: { icon: AlertTriangle, variant: 'warning' as const, color: 'text-warning' },
  info: { icon: Info, variant: 'secondary' as const, color: 'text-muted-foreground' },
  success: { icon: CheckCircle2, variant: 'success' as const, color: 'text-success' },
};

export function LogsPanel({ logs, maxHeight = '160px', compact = false }: LogsPanelProps) {
  return (
    <Card className="gradient-border min-w-0 overflow-hidden">
      <CardHeader className={cn('border-b border-border/40 bg-primary/5', compact ? 'p-2 pb-1.5' : 'p-3 pb-2')}>
        <CardTitle className={cn('flex items-center gap-2 font-bold', compact ? 'text-xs' : 'text-sm')}>
          <span className={cn('flex items-center justify-center rounded-lg bg-primary/10 text-primary', compact ? 'h-5 w-5' : 'h-6 w-6')}>
            <Info className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          </span>
          Live Logs
        </CardTitle>
      </CardHeader>
      <CardContent className={cn(compact ? 'p-2 pt-1.5' : 'p-3 pt-2')}>
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
                    className="flex items-start gap-2 rounded-xl border border-border/40 bg-white/50 p-2.5 text-xs backdrop-blur-sm"
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
