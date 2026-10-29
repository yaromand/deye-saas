export function PlaceholderPanel({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase?: string;
}) {
  return (
    <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-6">
      <h1 className="text-xl font-semibold text-zinc-900">{title}</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-600">
        {description}
      </p>
      {phase && (
        <p className="mt-4 text-xs uppercase tracking-wide text-emerald-700">
          {phase}
        </p>
      )}
    </section>
  );
}
