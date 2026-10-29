import { PlaceholderPanel } from "@/components/placeholder-panel";
import { listVendorAdapters } from "@/lib/vendors";

export default function InvertersPage() {
  const adapters = listVendorAdapters();

  return (
    <div className="flex flex-col gap-6">
      <PlaceholderPanel
        title="Инверторы"
        description="Подключение через облако вендора (Solarman / Deye). Список устройств и телеметрия появятся после реализации адаптера и polling worker."
        phase="Фаза 2 — Ingest"
      />
      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-medium text-zinc-900">
          Доступные адаптеры (заглушки)
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-600">
          {adapters.map((a) => (
            <li key={a.id} className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-600" />
              {a.id}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
