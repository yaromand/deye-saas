import { createHash, randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { telegramBots, telegramSubscribers } from "@/lib/db/schema";
import { deleteWebhook, getMe, setWebhook } from "@/lib/telegram/api";
import { requireTenant } from "@/lib/tenant";

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

function webhookUrl(tenantId: string) {
  return `${appBaseUrl()}/api/telegram/${tenantId}`;
}

export async function GET() {
  const auth = await requireTenant(["client"]);
  if (!auth.ok) return auth.response;

  const [bot] = await db
    .select()
    .from(telegramBots)
    .where(eq(telegramBots.tenantId, auth.session.tenantId))
    .limit(1);

  if (!bot) {
    return NextResponse.json({ bot: null, webhookUrl: webhookUrl(auth.session.tenantId) });
  }

  const subs = await db
    .select({
      id: telegramSubscribers.id,
      chatId: telegramSubscribers.chatId,
      active: telegramSubscribers.active,
      linkedAt: telegramSubscribers.linkedAt,
    })
    .from(telegramSubscribers)
    .where(eq(telegramSubscribers.botId, bot.id));

  return NextResponse.json({
    bot: {
      id: bot.id,
      botUsername: bot.botUsername,
      status: bot.status,
      hasToken: true,
      webhookUrl: webhookUrl(auth.session.tenantId),
      // secret never returned in plaintext — only whether set
      hasWebhookSecret: Boolean(bot.webhookSecret),
    },
    subscribers: subs,
  });
}

const saveSchema = z.object({
  botToken: z.string().min(20),
  registerWebhook: z.boolean().optional().default(true),
});

export async function POST(request: Request) {
  const auth = await requireTenant(["client"]);
  if (!auth.ok) return auth.response;

  const parsed = saveSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный токен" }, { status: 400 });
  }

  const token = parsed.data.botToken.trim();
  let username: string | undefined;
  try {
    const me = await getMe(token);
    username = me.username;
  } catch (err) {
    return NextResponse.json(
      {
        error: `Токен отклонён Telegram: ${err instanceof Error ? err.message : "error"}`,
      },
      { status: 400 },
    );
  }

  const webhookSecret = randomBytes(24).toString("hex");
  const encrypted = encryptSecret(token);

  const existing = await db
    .select({ id: telegramBots.id })
    .from(telegramBots)
    .where(eq(telegramBots.tenantId, auth.session.tenantId))
    .limit(1);

  let botId: string;
  if (existing[0]) {
    await db
      .update(telegramBots)
      .set({
        botTokenEncrypted: encrypted,
        botUsername: username,
        webhookSecret,
        status: "inactive",
        updatedAt: new Date(),
      })
      .where(eq(telegramBots.id, existing[0].id));
    botId = existing[0].id;
  } else {
    const [row] = await db
      .insert(telegramBots)
      .values({
        tenantId: auth.session.tenantId,
        botTokenEncrypted: encrypted,
        botUsername: username,
        webhookSecret,
        status: "inactive",
      })
      .returning({ id: telegramBots.id });
    botId = row.id;
  }

  let webhookRegistered = false;
  let webhookError: string | undefined;
  if (parsed.data.registerWebhook) {
    try {
      const url = webhookUrl(auth.session.tenantId);
      // Telegram secret_token: 1-256 chars A-Z, a-z, 0-9, _ and -
      const secretToken = createHash("sha256")
        .update(webhookSecret)
        .digest("hex")
        .slice(0, 64);
      await setWebhook(token, url, secretToken);
      // store hashed form we compare against header
      await db
        .update(telegramBots)
        .set({
          webhookSecret: secretToken,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(telegramBots.id, botId));
      webhookRegistered = true;
    } catch (err) {
      webhookError = err instanceof Error ? err.message : String(err);
      await db
        .update(telegramBots)
        .set({ status: "error", updatedAt: new Date() })
        .where(eq(telegramBots.id, botId));
    }
  }

  return NextResponse.json({
    ok: true,
    botUsername: username,
    webhookRegistered,
    webhookUrl: webhookUrl(auth.session.tenantId),
    webhookError,
    note:
      "Локально без публичного HTTPS webhook не зарегистрируется — используйте tunnel (ngrok/cloudflared) или long-poll later.",
  });
}

export async function DELETE() {
  const auth = await requireTenant(["client"]);
  if (!auth.ok) return auth.response;

  const [bot] = await db
    .select()
    .from(telegramBots)
    .where(eq(telegramBots.tenantId, auth.session.tenantId))
    .limit(1);

  if (!bot) {
    return NextResponse.json({ ok: true });
  }

  try {
    const token = decryptSecret(bot.botTokenEncrypted);
    await deleteWebhook(token);
  } catch {
    // ignore
  }

  await db.delete(telegramBots).where(eq(telegramBots.id, bot.id));
  return NextResponse.json({ ok: true });
}
