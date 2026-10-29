import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  alertEvents,
  alertRules,
  inverters,
} from "@/lib/db/schema";
import { getAlertQueue } from "@/lib/queues";

type PollSnapshot = {
  inverterId: string;
  tenantId: string;
  status?: "online" | "offline" | "unknown" | "error";
  powerW?: number;
  name?: string;
};

/**
 * After a successful poll, evaluate enabled alert rules for the tenant/inverter
 * and enqueue Telegram delivery jobs.
 */
export async function evaluateAlertsAfterPoll(
  snap: PollSnapshot,
): Promise<void> {
  const rules = await db
    .select()
    .from(alertRules)
    .where(
      and(
        eq(alertRules.tenantId, snap.tenantId),
        eq(alertRules.enabled, true),
      ),
    );

  const applicable = rules.filter(
    (r) => !r.inverterId || r.inverterId === snap.inverterId,
  );

  let inverterName = snap.name;
  if (!inverterName) {
    const [inv] = await db
      .select({ name: inverters.name })
      .from(inverters)
      .where(eq(inverters.id, snap.inverterId))
      .limit(1);
    inverterName = inv?.name;
  }

  for (const rule of applicable) {
    let fire = false;
    let reason = "";

    if (rule.type === "offline" && snap.status === "offline") {
      fire = true;
      reason = `Инвертор «${inverterName ?? snap.inverterId}» офлайн`;
    } else if (
      rule.type === "power_low" &&
      snap.powerW != null &&
      rule.threshold != null &&
      snap.powerW < rule.threshold
    ) {
      fire = true;
      reason = `Мощность ${Math.round(snap.powerW)} Вт < порога ${rule.threshold} Вт (${inverterName ?? ""})`;
    } else if (
      rule.type === "power_high" &&
      snap.powerW != null &&
      rule.threshold != null &&
      snap.powerW > rule.threshold
    ) {
      fire = true;
      reason = `Мощность ${Math.round(snap.powerW)} Вт > порога ${rule.threshold} Вт (${inverterName ?? ""})`;
    }

    if (!fire) continue;

    const [event] = await db
      .insert(alertEvents)
      .values({
        ruleId: rule.id,
        inverterId: snap.inverterId,
        payload: {
          type: rule.type,
          threshold: rule.threshold,
          powerW: snap.powerW,
          status: snap.status,
          message: reason,
        },
        deliveryStatus: "pending",
      })
      .returning({ id: alertEvents.id });

    try {
      await getAlertQueue().add(
        "send-alert",
        { alertEventId: event.id, tenantId: snap.tenantId },
        { removeOnComplete: 100, removeOnFail: 50, attempts: 3 },
      );
    } catch (err) {
      // Redis may be down — deliver inline as fallback
      console.warn(
        "[alerts] enqueue failed, inline send:",
        err instanceof Error ? err.message : err,
      );
      const { deliverAlertEvent } = await import("./deliver");
      await deliverAlertEvent(event.id, snap.tenantId);
    }
  }
}
