import { PlaceholderPanel } from "@/components/placeholder-panel";
import { getSession } from "@/lib/auth/session";

export const instant = false;

export default async function DashboardPage() {
  const session = await getSession();

  return (
    <div className="flex flex-col gap-6">
      <PlaceholderPanel
        title="Дашборд"
        description={`Добро пожаловать${session.email ? `, ${session.email}` : ""}. Здесь появятся сводные метрики мощности и энергии по вашим инверторам.`}
        phase="Фаза 3 — UI графиков"
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {["Мощность", "Энергия сегодня", "Онлайн"].map((label) => (
          <div
            key={label}
            className="rounded-lg border border-zinc-200 bg-white p-4"
          >
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-300">—</p>
          </div>
        ))}
      </div>
    </div>
  );
}
