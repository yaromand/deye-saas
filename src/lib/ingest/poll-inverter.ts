import { and, eq } from "drizzle-orm";
import { decryptCredentials } from "@/lib/credentials";
import { db } from "@/lib/db";
import {
  inverters,
  jobsAudit,
  telemetryPoints,
  vendorAccounts,
} from "@/lib/db/schema";
import { getVendorAdapter } from "@/lib/vendors";

export type PollResult = {
  ok: boolean;
  stub?: boolean;
  inverterId: string;
  status?: "online" | "offline" | "unknown" | "error";
  powerW?: number;
  energyKwh?: number;
  error?: string;
};

const OFFLINE_AFTER_MS = 15 * 60 * 1000;

/**
 * Fetch latest metrics for one inverter, write telemetry_points, update status.
 * Tenant-scoped: caller must pass matching tenantId.
 */
export async function pollInverter(
  inverterId: string,
  tenantId: string,
): Promise<PollResult> {
  try {
    const [row] = await db
      .select({
        inverter: inverters,
        account: vendorAccounts,
      })
      .from(inverters)
      .innerJoin(
        vendorAccounts,
        eq(inverters.vendorAccountId, vendorAccounts.id),
      )
      .where(
        and(eq(inverters.id, inverterId), eq(inverters.tenantId, tenantId)),
      )
      .limit(1);

    if (!row) {
      return { ok: false, inverterId, error: "inverter_not_found" };
    }

    const adapter = getVendorAdapter(row.account.vendor);
    if (!adapter) {
      return { ok: false, inverterId, error: "adapter_missing" };
    }

    const creds = decryptCredentials(row.account.credentialsEncrypted);
    const latest =
      (await adapter.fetchLatest?.(creds, row.inverter.externalDeviceId)) ??
      (
        await adapter.fetchTelemetry(
          creds,
          row.inverter.externalDeviceId,
          new Date(Date.now() - 60 * 60 * 1000),
          new Date(),
        )
      ).at(-1);

    if (!latest) {
      await db
        .update(inverters)
        .set({ status: "offline", updatedAt: new Date() })
        .where(eq(inverters.id, inverterId));
      return { ok: true, inverterId, status: "offline" };
    }

    const stub = Boolean(latest.metrics?.stub);
    const ageMs = Date.now() - latest.ts.getTime();
    let status: "online" | "offline" | "unknown" | "error" =
      latest.status === "offline"
        ? "offline"
        : latest.status === "online" || latest.status === "stub"
          ? "online"
          : "unknown";

    if (ageMs > OFFLINE_AFTER_MS) {
      status = "offline";
    } else if (status === "unknown" && latest.powerW != null) {
      status = "online";
    }

    await db.insert(telemetryPoints).values({
      inverterId,
      ts: latest.ts,
      metrics: {
        ...(latest.metrics ?? {}),
        status: latest.status,
      },
      powerW: latest.powerW,
      energyKwh: latest.energyKwh,
      soc: latest.soc,
    });

    await db
      .update(inverters)
      .set({
        status,
        lastSeenAt: latest.ts,
        updatedAt: new Date(),
        meta: {
          ...(row.inverter.meta ?? {}),
          lastPowerW: latest.powerW,
          lastEnergyKwh: latest.energyKwh,
          stub,
        },
      })
      .where(eq(inverters.id, inverterId));

    await db.insert(jobsAudit).values({
      type: "poll-inverter",
      ref: inverterId,
      finishedAt: new Date(),
    });

    try {
      const { evaluateAlertsAfterPoll } = await import("@/lib/telegram/alerts");
      await evaluateAlertsAfterPoll({
        inverterId,
        tenantId,
        status,
        powerW: latest.powerW,
        name: row.inverter.name,
      });
    } catch (err) {
      console.warn(
        "[poll] alert evaluation failed:",
        err instanceof Error ? err.message : err,
      );
    }

    return {
      ok: true,
      stub,
      inverterId,
      status,
      powerW: latest.powerW,
      energyKwh: latest.energyKwh,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[poll] inverter=${inverterId}`, message);

    await db
      .update(inverters)
      .set({ status: "error", updatedAt: new Date() })
      .where(
        and(eq(inverters.id, inverterId), eq(inverters.tenantId, tenantId)),
      )
      .catch(() => undefined);

    await db
      .insert(jobsAudit)
      .values({
        type: "poll-inverter",
        ref: inverterId,
        error: message.slice(0, 1000),
        finishedAt: new Date(),
      })
      .catch(() => undefined);

    return { ok: false, inverterId, status: "error", error: message };
  }
}

/** Enqueue or run poll for all active inverters of a tenant. */
export async function pollTenantInverters(tenantId: string): Promise<{
  results: PollResult[];
}> {
  const rows = await db
    .select({ id: inverters.id })
    .from(inverters)
    .where(eq(inverters.tenantId, tenantId));

  const results: PollResult[] = [];
  for (const row of rows) {
    results.push(await pollInverter(row.id, tenantId));
  }
  return { results };
}
