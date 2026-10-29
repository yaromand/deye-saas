"use client";

type Series = {
  label: string;
  values: Array<number | null>;
  color?: string;
};

/** Dual-series SVG chart for power/energy over a shared time axis. */
export function MetricsChart({
  labels,
  series,
  unit,
  emptyText = "Нет данных за выбранный период",
}: {
  labels: string[];
  series: Series[];
  unit?: string;
  emptyText?: string;
}) {
  const flat = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  if (!labels.length || !flat.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-500">
        {emptyText}
      </div>
    );
  }

  const w = 640;
  const h = 160;
  const padL = 36;
  const padR = 8;
  const padT = 12;
  const padB = 28;
  const min = Math.min(...flat, 0);
  const max = Math.max(...flat, 1);
  const span = max - min || 1;

  function xy(i: number, v: number) {
    const x =
      padL + (i / Math.max(labels.length - 1, 1)) * (w - padL - padR);
    const y = padT + (1 - (v - min) / span) * (h - padT - padB);
    return { x, y };
  }

  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-zinc-600">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: s.color ?? "#047857" }}
            />
            {s.label}
            {unit ? ` (${unit})` : ""}
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-40 w-full"
        role="img"
        aria-label="График метрик"
      >
        <line
          x1={padL}
          y1={h - padB}
          x2={w - padR}
          y2={h - padB}
          stroke="#e4e4e7"
        />
        <text x={4} y={padT + 4} className="fill-zinc-400" fontSize="10">
          {Math.round(max)}
        </text>
        <text x={4} y={h - padB} className="fill-zinc-400" fontSize="10">
          {Math.round(min)}
        </text>
        {series.map((s) => {
          const pts: string[] = [];
          s.values.forEach((v, i) => {
            if (v == null) return;
            const { x, y } = xy(i, v);
            pts.push(`${x},${y}`);
          });
          if (pts.length < 2) return null;
          return (
            <polyline
              key={s.label}
              fill="none"
              stroke={s.color ?? "#047857"}
              strokeWidth="2"
              points={pts.join(" ")}
            />
          );
        })}
        {labels.length > 1 && (
          <>
            <text
              x={padL}
              y={h - 8}
              className="fill-zinc-400"
              fontSize="10"
            >
              {labels[0]}
            </text>
            <text
              x={w - padR - 70}
              y={h - 8}
              className="fill-zinc-400"
              fontSize="10"
            >
              {labels[labels.length - 1]}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    online: "bg-emerald-100 text-emerald-800",
    offline: "bg-zinc-200 text-zinc-700",
    unknown: "bg-amber-100 text-amber-800",
    error: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${map[status] ?? map.unknown}`}
    >
      {status}
    </span>
  );
}
