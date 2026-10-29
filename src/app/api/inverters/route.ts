import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { decryptCredentials } from "@/lib/credentials";
import { db } from "@/lib/db";
import { inverters, vendorAccounts } from "@/lib/db/schema";
import { requireTenant } from "@/lib/tenant";
import { getVendorAdapter } from "@/lib/vendors";

const createSchema = z.object({
  vendorAccountId: z.string().uuid(),
  externalDeviceId: z.string().min(1).max(128).optional(),
  name: z.string().min(1).max(120).optional(),
  /** If true, discover devices from vendor and upsert all */
  discover: z.boolean().optional(),
});

export async function GET() {
  const auth = await requireTenant(["client", "admin"]);
  if (!auth.ok) return auth.response;

  const rows = await db
    .select({
      id: inverters.id,
      name: inverters.name,
      externalDeviceId: inverters.externalDeviceId,
      status: inverters.status,
      lastSeenAt: inverters.lastSeenAt,
      vendorAccountId: inverters.vendorAccountId,
      vendor: vendorAccounts.vendor,
      meta: inverters.meta,
      createdAt: inverters.createdAt,
    })
    .from(inverters)
    .innerJoin(
      vendorAccounts,
      eq(inverters.vendorAccountId, vendorAccounts.id),
    )
    .where(eq(inverters.tenantId, auth.session.tenantId));

  return NextResponse.json({ inverters: rows });
}

export async function POST(request: Request) {
  const auth = await requireTenant(["client"]);
  if (!auth.ok) return auth.response;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некорректные данные", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [account] = await db
    .select()
    .from(vendorAccounts)
    .where(
      and(
        eq(vendorAccounts.id, parsed.data.vendorAccountId),
        eq(vendorAccounts.tenantId, auth.session.tenantId),
      ),
    )
    .limit(1);

  if (!account) {
    return NextResponse.json(
      { error: "Аккаунт вендора не найден" },
      { status: 404 },
    );
  }

  if (parsed.data.discover) {
    const adapter = getVendorAdapter(account.vendor);
    if (!adapter) {
      return NextResponse.json({ error: "Адаптер не найден" }, { status: 400 });
    }
    const creds = decryptCredentials(account.credentialsEncrypted);
    const devices = await adapter.listDevices(creds);
    const created = [];
    for (const device of devices) {
      const [row] = await db
        .insert(inverters)
        .values({
          tenantId: auth.session.tenantId,
          vendorAccountId: account.id,
          externalDeviceId: device.externalDeviceId,
          name: device.name,
          meta: device.meta ?? {},
          status: device.status ?? "unknown",
        })
        .onConflictDoUpdate({
          target: [inverters.vendorAccountId, inverters.externalDeviceId],
          set: {
            name: device.name,
            meta: device.meta ?? {},
            updatedAt: new Date(),
          },
        })
        .returning({
          id: inverters.id,
          name: inverters.name,
          externalDeviceId: inverters.externalDeviceId,
        });
      if (row) created.push(row);
    }
    return NextResponse.json({ discovered: devices.length, created }, { status: 201 });
  }

  if (!parsed.data.externalDeviceId) {
    return NextResponse.json(
      { error: "Укажите externalDeviceId или discover: true" },
      { status: 400 },
    );
  }

  const [row] = await db
    .insert(inverters)
    .values({
      tenantId: auth.session.tenantId,
      vendorAccountId: account.id,
      externalDeviceId: parsed.data.externalDeviceId,
      name: parsed.data.name ?? parsed.data.externalDeviceId,
      status: "unknown",
    })
    .returning({
      id: inverters.id,
      name: inverters.name,
      externalDeviceId: inverters.externalDeviceId,
      status: inverters.status,
    });

  return NextResponse.json({ inverter: row }, { status: 201 });
}
