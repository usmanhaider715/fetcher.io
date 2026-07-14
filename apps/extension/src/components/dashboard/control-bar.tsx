import type { SessionStatus } from '@fetcher/shared';
import { Pause, Play, RotateCcw, Settings, Square, PanelRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface ControlBarProps {
  sessionStatus: SessionStatus;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onNewSession: () => void;
  onSettings: () => void;
  onOpenSidePanel: () => void;
  isLoading?: boolean;
}

export function ControlBar({
  sessionStatus,
  onStart,
  onPause,
  onResume,
  onStop,
  onNewSession,
  onSettings,
  onOpenSidePanel,
  isLoading = false,
}: ControlBarProps) {
  const isRunning = sessionStatus === 'running';
  const isPaused = sessionStatus === 'paused';
  const isActive = isRunning || isPaused;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {!isActive && (
          <Button onClick={onStart} disabled={isLoading} className="col-span-2" size="sm">
            <Play className="h-4 w-4" />
            Start Scraping
          </Button>
        )}

        {isRunning && (
          <Button onClick={onPause} variant="secondary" size="sm" disabled={isLoading}>
            <Pause className="h-4 w-4" />
            Pause
          </Button>
        )}

        {isPaused && (
          <Button onClick={onResume} size="sm" disabled={isLoading}>
            <Play className="h-4 w-4" />
            Resume
          </Button>
        )}

        {isActive && (
          <Button onClick={onStop} variant="destructive" size="sm" disabled={isLoading}>
            <Square className="h-4 w-4" />
            Stop
          </Button>
        )}

        <Button
          onClick={onNewSession}
          variant="outline"
          size="sm"
          className={isActive ? '' : 'w-full'}
          disabled={isLoading}
        >
          <RotateCcw className="h-4 w-4" />
          New Session
        </Button>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={onSettings} variant="outline" size="sm">
          <Settings className="h-4 w-4" />
          Settings
        </Button>
        <Button onClick={onOpenSidePanel} variant="outline" size="sm">
          <PanelRight className="h-4 w-4" />
          Side Panel
        </Button>
      </div>
    </div>
  );
}
