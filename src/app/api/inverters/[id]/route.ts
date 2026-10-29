import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inverters } from "@/lib/db/schema";
import { requireTenant } from "@/lib/tenant";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireTenant(["client"]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const deleted = await db
    .delete(inverters)
    .where(
      and(eq(inverters.id, id), eq(inverters.tenantId, auth.session.tenantId)),
    )
    .returning({ id: inverters.id });

  if (!deleted.length) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
