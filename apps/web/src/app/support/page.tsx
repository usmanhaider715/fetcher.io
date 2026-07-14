export default function SupportPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-4xl font-bold">Support</h1>
      <p className="mt-4 text-muted">Email support@fetcherio.dev or use the form below.</p>
      <form className="mt-8 space-y-4" action="mailto:support@fetcherio.dev" method="post" encType="text/plain">
        <input name="subject" placeholder="Subject" className="w-full rounded-lg border border-white/20 bg-card px-4 py-3" />
        <textarea name="body" rows={6} placeholder="How can we help?" className="w-full rounded-lg border border-white/20 bg-card px-4 py-3" />
        <button type="submit" className="rounded-lg bg-accent px-6 py-3 font-semibold">
          Send email
        </button>
      </form>
    </div>
  );
}
