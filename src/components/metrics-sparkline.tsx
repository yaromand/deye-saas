/** Simple SVG sparkline for power series — no chart library. */
export function MetricsSparkline({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  if (!values.length) {
    return (
      <div className={`flex h-24 items-center justify-center text-sm text-zinc-400 ${className ?? ""}`}>
        Нет точек
      </div>
    );
  }

  const w = 320;
  const h = 96;
  const pad = 4;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const span = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`h-24 w-full text-emerald-700 ${className ?? ""}`}
      role="img"
      aria-label="График мощности"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        points={points}
      />
    </svg>
  );
}
