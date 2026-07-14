export default function TermsPage() {
  return (
    <div className="prose prose-invert mx-auto max-w-3xl px-4 py-16">
      <h1>Terms of Service</h1>
      <p>Last updated: July 2026</p>
      <p>
        Fetcher.io provides software for product research and publishing. You are responsible for complying with
        target-site terms of service and applicable laws in your jurisdiction.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Use Fetcher.io only on data you have a legitimate right to access. Do not use the tool to circumvent
        technical protections, solve CAPTCHAs, or scrape sites that prohibit automated access in their ToS.
      </p>
      <h2>Local-first architecture</h2>
      <p>
        Scraping runs in your browser. We do not operate a centralized scraping farm. Cloud services cover
        account management, billing, AI proxy, and publishing orchestration.
      </p>
    </div>
  );
}
