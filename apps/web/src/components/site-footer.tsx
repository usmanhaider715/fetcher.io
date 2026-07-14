import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-white/10 bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4">
        <div>
          <p className="font-bold">Fetcher.io</p>
          <p className="mt-2 text-sm text-muted">Local-first product intelligence for e-commerce teams.</p>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold">Product</p>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href="/pricing" className="no-underline hover:text-white">Pricing</Link></li>
            <li><Link href="/docs" className="no-underline hover:text-white">Documentation</Link></li>
            <li><Link href="/blog" className="no-underline hover:text-white">Blog</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold">Legal</p>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href="/legal/terms" className="no-underline hover:text-white">Terms of Service</Link></li>
            <li><Link href="/legal/privacy" className="no-underline hover:text-white">Privacy Policy</Link></li>
            <li><Link href="/legal/aup" className="no-underline hover:text-white">Acceptable Use</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold">Support</p>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href="/support" className="no-underline hover:text-white">Help Center</Link></li>
            <li><a href="mailto:support@fetcherio.dev" className="no-underline hover:text-white">support@fetcherio.dev</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-6 text-center text-xs text-muted">
        © {new Date().getFullYear()} Fetcher.io. Scraping responsibly is your responsibility — see our AUP.
      </div>
    </footer>
  );
}
