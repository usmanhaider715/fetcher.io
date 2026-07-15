import Link from 'next/link';
import { BrandLogo } from '@/components/layout/brand-logo';

export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-24 border-t border-border/50 glass">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4">
        <div>
          <BrandLogo size="sm" className="mb-3" />
          <p className="text-sm text-muted-foreground">
            Local-first product intelligence for e-commerce teams.
          </p>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-foreground">Product</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/pricing" className="no-underline hover:text-primary">Pricing</Link></li>
            <li><Link href="/docs" className="no-underline hover:text-primary">Documentation</Link></li>
            <li><Link href="/blog" className="no-underline hover:text-primary">Blog</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-foreground">Legal</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/legal/terms" className="no-underline hover:text-primary">Terms of Service</Link></li>
            <li><Link href="/privacy" className="no-underline hover:text-primary">Privacy Policy</Link></li>
            <li><Link href="/legal/aup" className="no-underline hover:text-primary">Acceptable Use</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-foreground">Support</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/support" className="no-underline hover:text-primary">Help Center</Link></li>
            <li>
              <a href="mailto:support@productfetcher.online" className="no-underline hover:text-primary">
                support@productfetcher.online
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/40 px-4 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Fetcher.io. Scraping responsibly is your responsibility — see our AUP.
      </div>
    </footer>
  );
}
