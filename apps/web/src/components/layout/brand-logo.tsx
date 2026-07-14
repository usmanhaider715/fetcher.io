import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function BrandLogo({ className, size = 'md' }: BrandLogoProps) {
  const sizes = {
    sm: { icon: 'h-8 w-8', iconInner: 'h-4 w-4', text: 'text-base' },
    md: { icon: 'h-9 w-9', iconInner: 'h-5 w-5', text: 'text-lg' },
    lg: { icon: 'h-11 w-11', iconInner: 'h-6 w-6', text: 'text-xl' },
  };
  const s = sizes[size];

  return (
    <Link href="/" className={cn('flex items-center gap-2.5 no-underline', className)}>
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-purple-500 text-white shadow-glow',
          s.icon,
        )}
      >
        <Sparkles className={s.iconInner} />
      </div>
      <span className={cn('font-bold tracking-tight text-foreground', s.text)}>Fetcher.io</span>
    </Link>
  );
}
