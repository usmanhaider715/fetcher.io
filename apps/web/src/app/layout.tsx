import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'Fetcher.io — Product Intelligence Platform', template: '%s | Fetcher.io' },
  description:
    'Local-first Chrome extension for e-commerce scraping, AI enrichment, and store publishing — with cloud auth, billing, and orchestration.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_MARKETING_URL ?? 'https://fetcherio.dev'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
