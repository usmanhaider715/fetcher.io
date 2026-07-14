import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { PremiumBackground } from '@/components/layout/premium-background';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: { default: 'Fetcher.io — Product Intelligence Platform', template: '%s | Fetcher.io' },
  description:
    'Local-first Chrome extension for e-commerce scraping, AI enrichment, and store publishing — with cloud auth, billing, and orchestration.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_MARKETING_URL ?? 'https://productfetcher.online'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plusJakarta.variable}>
      <body className="font-sans">
        <div className="premium-bg relative min-h-screen">
          <PremiumBackground />
          <div className="relative z-10 flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </div>
      </body>
    </html>
  );
}
