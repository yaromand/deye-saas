/** Minimal Telegram Bot API client (per-tenant bot token). */

const API = "https://api.telegram.org";

export type TelegramUser = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  username?: string;
};

export type TelegramChat = {
  id: number;
  type: string;
  title?: string;
  username?: string;
};

export type TelegramMessage = {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
  date: number;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

type ApiResult<T> = { ok: true; result: T } | { ok: false; description?: string };

async function call<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = (await res.json()) as ApiResult<T>;
  if (!data.ok) {
    throw new Error(data.description ?? `Telegram ${method} failed`);
  }
  return data.result;
}

export async function getMe(token: string) {
  return call<{ id: number; username?: string; first_name?: string }>(
    token,
    "getMe",
  );
}

export async function setWebhook(
  token: string,
  url: string,
  secretToken?: string,
) {
  return call<boolean>(token, "setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message"],
    drop_pending_updates: false,
  });
}

export async function deleteWebhook(token: string) {
  return call<boolean>(token, "deleteWebhook", {
    drop_pending_updates: false,
  });
}

export async function sendMessage(
  token: string,
  chatId: string | number,
  text: string,
) {
  return call<TelegramMessage>(token, "sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
}
