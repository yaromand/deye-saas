import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  encryptCredentials,
  publicCredentialHints,
  decryptCredentials,
} from "@/lib/credentials";
import { db } from "@/lib/db";
import { vendorAccounts } from "@/lib/db/schema";
import { requireTenant } from "@/lib/tenant";
import { getVendorAdapter } from "@/lib/vendors";

const optionalString = z.string().optional();

const createSchema = z.object({
  vendor: z.enum(["solarman", "deye", "felicity"]),
  label: z.string().max(120).optional(),
  credentials: z.object({
    appId: optionalString,
    appSecret: optionalString,
    email: optionalString,
    username: optionalString,
    mobile: optionalString,
    countryCode: optionalString,
    password: optionalString,
    accessToken: optionalString,
    refreshToken: optionalString,
    baseUrl: optionalString,
    orgId: optionalString,
    stationId: optionalString,
  }),
});


export async function GET() {
  const auth = await requireTenant(["client", "admin"]);
  if (!auth.ok) return auth.response;

  const rows = await db
    .select()
    .from(vendorAccounts)
    .where(eq(vendorAccounts.tenantId, auth.session.tenantId));

  return NextResponse.json({
    accounts: rows.map((row) => {
      let hints = {};
      try {
        hints = publicCredentialHints(decryptCredentials(row.credentialsEncrypted));
      } catch {
        hints = { error: "decrypt_failed" };
      }
      return {
        id: row.id,
        vendor: row.vendor,
        label: row.label,
        status: row.status,
        createdAt: row.createdAt,
        credentials: hints,
      };
    }),
  });
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

  const adapter = getVendorAdapter(parsed.data.vendor);
  if (!adapter) {
    return NextResponse.json(
      { error: "Адаптер вендора не найден (Felicity — later)" },
      { status: 400 },
    );
  }

  const creds = Object.fromEntries(
    Object.entries(parsed.data.credentials).filter(
      ([, v]) => v !== undefined && v !== "",
    ),
  );

  const valid = await adapter.validateCredentials(creds);
  if (!valid) {
    return NextResponse.json(
      { error: "Не удалось проверить учётные данные вендора" },
      { status: 400 },
    );
  }

  const [row] = await db
    .insert(vendorAccounts)
    .values({
      tenantId: auth.session.tenantId,
      vendor: parsed.data.vendor,
      label: parsed.data.label ?? `${parsed.data.vendor} account`,
      credentialsEncrypted: encryptCredentials(creds),
      status: "active",
    })
    .returning({
      id: vendorAccounts.id,
      vendor: vendorAccounts.vendor,
      label: vendorAccounts.label,
      status: vendorAccounts.status,
    });

  return NextResponse.json({ account: row }, { status: 201 });
}
