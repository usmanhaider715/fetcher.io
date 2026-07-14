export default function DownloadsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Downloads</h1>
      <p className="mt-2 text-muted">
        Cloud export packages appear here with signed, expiring links. Local exports from the extension save directly to your disk.
      </p>
      <div className="mt-12 rounded-xl border border-dashed border-white/20 p-12 text-center text-muted">
        No cloud exports yet. Enable cloud backup in project settings to sync ZIP/CSV packages.
      </div>
    </div>
  );
}
