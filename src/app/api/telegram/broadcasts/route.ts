import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { broadcasts } from "@/lib/db/schema";
import { getBroadcastQueue } from "@/lib/queues";
import { deliverBroadcast } from "@/lib/telegram/deliver";
import { requireTenant } from "@/lib/tenant";

export async function GET() {
  const auth = await requireTenant(["client"]);
  if (!auth.ok) return auth.response;

  const rows = await db
    .select({
      id: broadcasts.id,
      text: broadcasts.text,
      status: broadcasts.status,
      sentCount: broadcasts.sentCount,
      createdAt: broadcasts.createdAt,
    })
    .from(broadcasts)
    .where(eq(broadcasts.tenantId, auth.session.tenantId))
    .orderBy(desc(broadcasts.createdAt))
    .limit(50);

  return NextResponse.json({ broadcasts: rows });
}

const createSchema = z.object({
  text: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  const auth = await requireTenant(["client"]);
  if (!auth.ok) return auth.response;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Пустое сообщение" }, { status: 400 });
  }

  const [row] = await db
    .insert(broadcasts)
    .values({
      tenantId: auth.session.tenantId,
      text: parsed.data.text,
      createdBy: auth.session.userId,
      status: "queued",
    })
    .returning({
      id: broadcasts.id,
      text: broadcasts.text,
      status: broadcasts.status,
    });

  let result: { sent: number; error?: string } | undefined;
  try {
    await getBroadcastQueue().add(
      "broadcast",
      { broadcastId: row.id, tenantId: auth.session.tenantId },
      { removeOnComplete: 50, removeOnFail: 20, attempts: 2 },
    );
  } catch {
    result = await deliverBroadcast(row.id, auth.session.tenantId);
  }

  return NextResponse.json({ broadcast: row, result }, { status: 201 });
}
