import { InvertersPanel } from "@/components/inverters-panel";
import { listVendorAdapters } from "@/lib/vendors";

export const instant = false;

export default function InvertersPage() {
  const adapters = listVendorAdapters().map((a) => ({
    id: String(a.id),
    credentialFields: a.credentialFields,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Инверторы</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600">
          Подключение через Solarman / Deye Open API. Добавьте credentials,
          обнаружьте устройства или укажите SN вручную, затем Sync для записи
          телеметрии.
        </p>
      </div>
      <InvertersPanel adapters={adapters} />
    </div>
  );
}
