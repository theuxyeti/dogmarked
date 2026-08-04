export const metadata = { title: "Public profile" };

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <p className="text-xs uppercase tracking-[0.14em] text-muted">Public profile</p>
      <h1 className="font-display text-4xl text-teal-deep">@{handle}</h1>
      <p className="mt-3 text-muted">
        Phase 3 stub — followable maps, public saves, and contribution history will live here.
      </p>
    </div>
  );
}
