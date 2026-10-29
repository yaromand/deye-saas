import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { decryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { telegramBots, telegramSubscribers } from "@/lib/db/schema";
import { sendMessage, type TelegramUpdate } from "@/lib/telegram/api";

type RouteContext = { params: Promise<{ tenantId: string }> };

/**
 * Telegram webhook for a tenant's bot.
 * Auth: header `X-Telegram-Bot-Api-Secret-Token` must match stored webhookSecret.
 * /start — subscribe chat; /stop — unsubscribe.
 */
export async function POST(request: Request, context: RouteContext) {
  const { tenantId } = await context.params;
  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");

  const [bot] = await db
    .select()
    .from(telegramBots)
    .where(eq(telegramBots.tenantId, tenantId))
    .limit(1);

  if (!bot) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  if (!bot.webhookSecret || secretHeader !== bot.webhookSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  const message = update?.message;
  if (!message?.chat?.id) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const text = (message.text ?? "").trim();
  const token = decryptSecret(bot.botTokenEncrypted);

  if (text.startsWith("/start")) {
    await db
      .insert(telegramSubscribers)
      .values({
        botId: bot.id,
        chatId,
        active: true,
      })
      .onConflictDoUpdate({
        target: [telegramSubscribers.botId, telegramSubscribers.chatId],
        set: { active: true, linkedAt: new Date() },
      });

    try {
      await sendMessage(
        token,
        chatId,
        "Вы подписаны на алерты Cloud Deye. Команда /stop отключает уведомления.",
      );
    } catch {
      // ignore send failures on subscribe ack
    }
  } else if (text.startsWith("/stop")) {
    await db
      .update(telegramSubscribers)
      .set({ active: false })
      .where(
        and(
          eq(telegramSubscribers.botId, bot.id),
          eq(telegramSubscribers.chatId, chatId),
        ),
      );
    try {
      await sendMessage(token, chatId, "Подписка отключена.");
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ ok: true });
}
