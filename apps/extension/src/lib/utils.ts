import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function getPlatformLabel(platform: string | null): string {
  if (!platform) return 'Unknown';
  return platform
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'running':
      return 'text-primary';
    case 'paused':
      return 'text-warning';
    case 'completed':
      return 'text-success';
    case 'error':
    case 'stopped':
      return 'text-destructive';
    default:
      return 'text-muted-foreground';
  }
}
