import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { alertEvents, alertRules, inverters } from "@/lib/db/schema";
import { requireTenant } from "@/lib/tenant";

export async function GET() {
  const auth = await requireTenant(["client"]);
  if (!auth.ok) return auth.response;

  const rules = await db
    .select({
      id: alertRules.id,
      type: alertRules.type,
      threshold: alertRules.threshold,
      enabled: alertRules.enabled,
      inverterId: alertRules.inverterId,
      createdAt: alertRules.createdAt,
    })
    .from(alertRules)
    .where(eq(alertRules.tenantId, auth.session.tenantId))
    .orderBy(desc(alertRules.createdAt));

  const events = await db
    .select({
      id: alertEvents.id,
      ruleId: alertEvents.ruleId,
      inverterId: alertEvents.inverterId,
      firedAt: alertEvents.firedAt,
      deliveryStatus: alertEvents.deliveryStatus,
      payload: alertEvents.payload,
    })
    .from(alertEvents)
    .innerJoin(alertRules, eq(alertEvents.ruleId, alertRules.id))
    .where(eq(alertRules.tenantId, auth.session.tenantId))
    .orderBy(desc(alertEvents.firedAt))
    .limit(30);

  return NextResponse.json({ rules, events });
}

const createSchema = z.object({
  type: z.enum(["offline", "power_low", "power_high", "energy_threshold", "custom"]),
  threshold: z.number().optional().nullable(),
  inverterId: z.string().uuid().optional().nullable(),
  enabled: z.boolean().optional().default(true),
});

export async function POST(request: Request) {
  const auth = await requireTenant(["client"]);
  if (!auth.ok) return auth.response;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  if (parsed.data.inverterId) {
    const [inv] = await db
      .select({ id: inverters.id })
      .from(inverters)
      .where(
        and(
          eq(inverters.id, parsed.data.inverterId),
          eq(inverters.tenantId, auth.session.tenantId),
        ),
      )
      .limit(1);
    if (!inv) {
      return NextResponse.json({ error: "Инвертор не найден" }, { status: 404 });
    }
  }

  if (
    (parsed.data.type === "power_low" || parsed.data.type === "power_high") &&
    parsed.data.threshold == null
  ) {
    return NextResponse.json(
      { error: "Для порога мощности укажите threshold" },
      { status: 400 },
    );
  }

  const [rule] = await db
    .insert(alertRules)
    .values({
      tenantId: auth.session.tenantId,
      type: parsed.data.type,
      threshold: parsed.data.threshold ?? null,
      inverterId: parsed.data.inverterId ?? null,
      enabled: parsed.data.enabled ?? true,
    })
    .returning({
      id: alertRules.id,
      type: alertRules.type,
      threshold: alertRules.threshold,
      enabled: alertRules.enabled,
    });

  return NextResponse.json({ rule }, { status: 201 });
}
