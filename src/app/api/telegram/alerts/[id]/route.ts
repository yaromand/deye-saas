import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { alertRules } from "@/lib/db/schema";
import { requireTenant } from "@/lib/tenant";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  threshold: z.number().nullable().optional(),
});

export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireTenant(["client"]);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const [row] = await db
    .update(alertRules)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(
      and(eq(alertRules.id, id), eq(alertRules.tenantId, auth.session.tenantId)),
    )
    .returning({ id: alertRules.id, enabled: alertRules.enabled });

  if (!row) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
  return NextResponse.json({ rule: row });
}

export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireTenant(["client"]);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  const deleted = await db
    .delete(alertRules)
    .where(
      and(eq(alertRules.id, id), eq(alertRules.tenantId, auth.session.tenantId)),
    )
    .returning({ id: alertRules.id });

  if (!deleted.length) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
