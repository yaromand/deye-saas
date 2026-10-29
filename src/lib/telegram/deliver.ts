import { and, eq } from "drizzle-orm";
import { decryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import {
  alertEvents,
  broadcasts,
  telegramBots,
  telegramSubscribers,
} from "@/lib/db/schema";
import { sendMessage } from "./api";

export async function deliverAlertEvent(
  alertEventId: string,
  tenantId: string,
): Promise<{ sent: number; error?: string }> {
  const [event] = await db
    .select()
    .from(alertEvents)
    .where(eq(alertEvents.id, alertEventId))
    .limit(1);

  if (!event) return { sent: 0, error: "event_not_found" };

  const [bot] = await db
    .select()
    .from(telegramBots)
    .where(
      and(
        eq(telegramBots.tenantId, tenantId),
        eq(telegramBots.status, "active"),
      ),
    )
    .limit(1);

  if (!bot) {
    await db
      .update(alertEvents)
      .set({ deliveryStatus: "skipped" })
      .where(eq(alertEvents.id, alertEventId));
    return { sent: 0, error: "no_active_bot" };
  }

  const token = decryptSecret(bot.botTokenEncrypted);
  const subs = await db
    .select()
    .from(telegramSubscribers)
    .where(
      and(
        eq(telegramSubscribers.botId, bot.id),
        eq(telegramSubscribers.active, true),
      ),
    );

  const message =
    (event.payload as { message?: string } | null)?.message ??
    "Cloud Deye: сработал алерт";

  let sent = 0;
  let lastError: string | undefined;
  for (const sub of subs) {
    try {
      await sendMessage(token, sub.chatId, `⚠️ ${message}`);
      sent += 1;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  await db
    .update(alertEvents)
    .set({ deliveryStatus: sent > 0 ? "sent" : "failed" })
    .where(eq(alertEvents.id, alertEventId));

  return { sent, error: sent === 0 ? lastError : undefined };
}

export async function deliverBroadcast(
  broadcastId: string,
  tenantId: string,
): Promise<{ sent: number; error?: string }> {
  const [row] = await db
    .select()
    .from(broadcasts)
    .where(
      and(eq(broadcasts.id, broadcastId), eq(broadcasts.tenantId, tenantId)),
    )
    .limit(1);

  if (!row) return { sent: 0, error: "broadcast_not_found" };

  await db
    .update(broadcasts)
    .set({ status: "sending" })
    .where(eq(broadcasts.id, broadcastId));

  const [bot] = await db
    .select()
    .from(telegramBots)
    .where(
      and(
        eq(telegramBots.tenantId, tenantId),
        eq(telegramBots.status, "active"),
      ),
    )
    .limit(1);

  if (!bot) {
    await db
      .update(broadcasts)
      .set({ status: "failed" })
      .where(eq(broadcasts.id, broadcastId));
    return { sent: 0, error: "no_active_bot" };
  }

  const token = decryptSecret(bot.botTokenEncrypted);
  const subs = await db
    .select()
    .from(telegramSubscribers)
    .where(
      and(
        eq(telegramSubscribers.botId, bot.id),
        eq(telegramSubscribers.active, true),
      ),
    );

  let sent = 0;
  let lastError: string | undefined;
  for (const sub of subs) {
    try {
      await sendMessage(token, sub.chatId, row.text);
      sent += 1;
      // light rate-limit: ~20 msg/s max; stay safer
      await new Promise((r) => setTimeout(r, 50));
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  await db
    .update(broadcasts)
    .set({
      status: sent > 0 ? "done" : "failed",
      sentCount: sent,
    })
    .where(eq(broadcasts.id, broadcastId));

  return { sent, error: sent === 0 ? lastError : undefined };
}
