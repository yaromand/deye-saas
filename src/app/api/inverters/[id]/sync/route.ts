import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inverters } from "@/lib/db/schema";
import { pollInverter } from "@/lib/ingest/poll-inverter";
import { getPollQueue } from "@/lib/queues";
import { requireTenant } from "@/lib/tenant";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Trigger sync for one inverter.
 * Runs poll inline (so UI works without worker) and also enqueues BullMQ when Redis is up.
 */
export async function POST(_request: Request, context: Ctx) {
  const auth = await requireTenant(["client"]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const [row] = await db
    .select({ id: inverters.id })
    .from(inverters)
    .where(
      and(eq(inverters.id, id), eq(inverters.tenantId, auth.session.tenantId)),
    )
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  const result = await pollInverter(id, auth.session.tenantId);

  try {
    await getPollQueue().add(
      "poll",
      { inverterId: id, tenantId: auth.session.tenantId },
      { removeOnComplete: 50, removeOnFail: 20 },
    );
  } catch (err) {
    console.warn(
      "[sync] enqueue skipped:",
      err instanceof Error ? err.message : err,
    );
  }

  return NextResponse.json({ result });
}
