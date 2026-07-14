export default function ConnectorsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Connectors</h1>
      <p className="mt-2 text-muted">
        Connect Shopify, WooCommerce, and more. Publishing uses scoped upload tokens — the API never stores full product payloads.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {['Shopify', 'WooCommerce', 'BigCommerce', 'Magento'].map((name) => (
          <div key={name} className="rounded-xl border border-white/10 p-6">
            <h2 className="font-semibold">{name}</h2>
            <p className="mt-2 text-sm text-muted">Configure credentials in the Chrome extension options page.</p>
            <button type="button" className="mt-4 rounded-lg border border-white/20 px-4 py-2 text-sm" disabled>
              Not connected
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
