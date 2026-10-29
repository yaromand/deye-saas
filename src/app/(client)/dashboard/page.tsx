import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { inverters, telemetryPoints } from "@/lib/db/schema";

export const instant = false;

export default async function DashboardPage() {
  const session = await getSession();
  const tenantId = session.tenantId ?? session.userId;

  let invRows: Array<{
    id: string;
    name: string;
    status: string;
    lastSeenAt: Date | null;
  }> = [];
  let latestPower: number | null = null;
  let onlineCount = 0;

  if (tenantId) {
    try {
      invRows = await db
        .select({
          id: inverters.id,
          name: inverters.name,
          status: inverters.status,
          lastSeenAt: inverters.lastSeenAt,
        })
        .from(inverters)
        .where(eq(inverters.tenantId, tenantId));

      onlineCount = invRows.filter((i) => i.status === "online").length;

      if (invRows[0]) {
        const [point] = await db
          .select({ powerW: telemetryPoints.powerW })
          .from(telemetryPoints)
          .innerJoin(inverters, eq(telemetryPoints.inverterId, inverters.id))
          .where(
            and(
              eq(inverters.tenantId, tenantId),
              sql`${telemetryPoints.powerW} is not null`,
            ),
          )
          .orderBy(desc(telemetryPoints.ts))
          .limit(1);
        latestPower = point?.powerW ?? null;
      }
    } catch {
      // DB may be down in scaffold/dev without docker
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Дашборд</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Добро пожаловать{session.email ? `, ${session.email}` : ""}. Сводка по
          инверторам тенанта.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Мощность (посл.)
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">
            {latestPower != null ? `${Math.round(latestPower)} Вт` : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Инверторы
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">
            {invRows.length}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Онлайн</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">
            {onlineCount}
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-zinc-900">Устройства</h2>
          <Link
            href="/inverters"
            className="text-sm text-emerald-700 hover:underline"
          >
            Управление →
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-zinc-100 text-sm">
          {invRows.length === 0 && (
            <li className="py-2 text-zinc-500">
              Нет инверторов.{" "}
              <Link href="/inverters" className="text-emerald-700 hover:underline">
                Подключить
              </Link>
            </li>
          )}
          {invRows.map((inv) => (
            <li key={inv.id} className="flex justify-between gap-3 py-2">
              <span className="font-medium text-zinc-800">{inv.name}</span>
              <span className="text-zinc-500">{inv.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
