export default function PrivacyPage() {
  return (
    <div className="prose prose-invert mx-auto max-w-3xl px-4 py-16">
      <h1>Privacy Policy</h1>
      <p>Last updated: July 2026</p>
      <p>
        We collect account information (email, name), usage metadata (job counts, AI call metering), and billing
        data via Stripe. Product payloads scraped locally are not uploaded unless you enable cloud backup.
      </p>
      <h2>Data retention</h2>
      <p>Account data is retained while your subscription is active. You may request deletion from Settings.</p>
    </div>
  );
}
