import { and, desc, eq, gte, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inverters, telemetryPoints } from "@/lib/db/schema";
import { requireTenant } from "@/lib/tenant";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  const auth = await requireTenant(["client", "admin"]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const url = new URL(request.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 500), 2000);

  const to = toParam ? new Date(toParam) : new Date();
  const from = fromParam
    ? new Date(fromParam)
    : new Date(to.getTime() - 24 * 60 * 60 * 1000);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: "Некорректный диапазон дат" }, { status: 400 });
  }

  const [inv] = await db
    .select({ id: inverters.id, name: inverters.name, status: inverters.status })
    .from(inverters)
    .where(
      and(eq(inverters.id, id), eq(inverters.tenantId, auth.session.tenantId)),
    )
    .limit(1);

  if (!inv) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  const points = await db
    .select({
      id: telemetryPoints.id,
      ts: telemetryPoints.ts,
      powerW: telemetryPoints.powerW,
      energyKwh: telemetryPoints.energyKwh,
      soc: telemetryPoints.soc,
      metrics: telemetryPoints.metrics,
    })
    .from(telemetryPoints)
    .where(
      and(
        eq(telemetryPoints.inverterId, id),
        gte(telemetryPoints.ts, from),
        lte(telemetryPoints.ts, to),
      ),
    )
    .orderBy(desc(telemetryPoints.ts))
    .limit(limit);

  return NextResponse.json({
    inverter: inv,
    from: from.toISOString(),
    to: to.toISOString(),
    points: points.reverse(),
  });
}
