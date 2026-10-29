import { NextResponse } from "next/server";
import { pollTenantInverters } from "@/lib/ingest/poll-inverter";
import { requireTenant } from "@/lib/tenant";

/** Sync all inverters for the current tenant (inline). */
export async function POST() {
  const auth = await requireTenant(["client"]);
  if (!auth.ok) return auth.response;

  const { results } = await pollTenantInverters(auth.session.tenantId);
  return NextResponse.json({ results });
}
