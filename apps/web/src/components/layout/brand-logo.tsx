import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function BrandLogo({ className, size = 'md' }: BrandLogoProps) {
  const sizes = {
    sm: { icon: 32, text: 'text-base' },
    md: { icon: 36, text: 'text-lg' },
    lg: { icon: 44, text: 'text-xl' },
  };
  const s = sizes[size];

  return (
    <Link href="/" className={cn('flex items-center gap-2.5 no-underline', className)}>
      <Image
        src="/logo.png"
        alt="Fetcher.io"
        width={s.icon}
        height={s.icon}
        className="shrink-0"
        priority
      />
      <span className={cn('font-bold tracking-tight text-foreground', s.text)}>Fetcher.io</span>
    </Link>
  );
}
