export default function TeamPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Team</h1>
      <p className="mt-2 text-muted">Invite members, assign roles (owner, admin, member), and manage seats per plan.</p>
      <div className="mt-12 rounded-xl border border-dashed border-white/20 p-12 text-center text-muted">
        Team invites available on Pro and Team plans. Upgrade in Billing to add members.
      </div>
    </div>
  );
}
