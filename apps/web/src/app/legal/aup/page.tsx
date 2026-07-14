export default function AupPage() {
  return (
    <div className="prose prose-invert mx-auto max-w-3xl px-4 py-16">
      <h1>Acceptable Use Policy</h1>
      <p>Fetcher.io is built with ethical guardrails:</p>
      <ul>
        <li>robots.txt is respected by default; overrides are explicit and logged</li>
        <li>Per-domain rate limits prevent hammering target sites</li>
        <li>No CAPTCHA solving or anti-bot circumvention</li>
        <li>Trend scores disclose inputs, weights, and confidence — never fabricated data</li>
      </ul>
      <p>Violations may result in account suspension.</p>
    </div>
  );
}
