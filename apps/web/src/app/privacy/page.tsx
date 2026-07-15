import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy',
  description: 'How Fetcher.io collects, uses, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: July 15, 2026</p>

      <div className="prose prose-neutral mt-10 max-w-none space-y-8 text-foreground">
        <section>
          <h2 className="text-xl font-semibold">Overview</h2>
          <p className="text-muted-foreground">
            Fetcher.io (&quot;we&quot;, &quot;us&quot;) operates the website at{' '}
            <a href="https://productfetcher.online">productfetcher.online</a>, the dashboard at{' '}
            <a href="https://app.productfetcher.online">app.productfetcher.online</a>, the cloud API at{' '}
            <a href="https://api.productfetcher.online">api.productfetcher.online</a>, and the Fetcher.io Chrome
            extension. This policy explains what we collect and how we use it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">What we collect</h2>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              <strong className="text-foreground">Account data:</strong> email, name, password hash, organization and
              plan when you register or sign in.
            </li>
            <li>
              <strong className="text-foreground">Usage metadata:</strong> scrape run summaries (mode, URL, product
              counts, status, project assignment). We do not upload full product catalogs or images to our servers by
              default.
            </li>
            <li>
              <strong className="text-foreground">Extension settings:</strong> preferences stored in Chrome sync/local
              storage on your device (theme, categories, account link token).
            </li>
            <li>
              <strong className="text-foreground">Local scrape data:</strong> product text, images, and exports are
              stored on your computer by the local data service until you download and delete them.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">What we do not collect</h2>
          <p className="text-muted-foreground">
            We do not sell your personal data. We do not store scraped product images or full product payloads on our
            cloud servers unless you explicitly enable a future cloud backup feature. Store credentials (Shopify,
            WooCommerce) stay in your extension settings and are used only from your machine to push to your store.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Chrome extension permissions</h2>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li><strong className="text-foreground">tabs / activeTab</strong> — read the page you are scraping</li>
            <li><strong className="text-foreground">storage</strong> — save settings and session state</li>
            <li><strong className="text-foreground">downloads</strong> — save exports to your computer</li>
            <li><strong className="text-foreground">host access</strong> — interact with sites you visit for scraping</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Data retention</h2>
          <p className="text-muted-foreground">
            Account and run-summary data is kept while your account is active. You may request deletion by contacting{' '}
            <a href="mailto:support@productfetcher.online">support@productfetcher.online</a>. Local scrape files on your
            device are removed when you use &quot;Free local data&quot; in the extension after download.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Third parties</h2>
          <p className="text-muted-foreground">
            We may use infrastructure providers (hosting, email) to operate the service. Payment processing (when
            enabled) is handled by Stripe; we do not store full card numbers.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Contact</h2>
          <p className="text-muted-foreground">
            Questions about this policy:{' '}
            <a href="mailto:support@productfetcher.online">support@productfetcher.online</a>
          </p>
          <p className="mt-4">
            <Link href="/" className="font-semibold text-primary no-underline">
              ← Back to home
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
