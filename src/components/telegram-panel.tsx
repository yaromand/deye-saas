"use client";

import { useCallback, useEffect, useState } from "react";

type BotInfo = {
  id: string;
  botUsername: string | null;
  status: string;
  hasToken: boolean;
  webhookUrl: string;
  hasWebhookSecret: boolean;
} | null;

type Subscriber = {
  id: string;
  chatId: string;
  active: boolean;
  linkedAt: string;
};

type AlertRule = {
  id: string;
  type: string;
  threshold: number | null;
  enabled: boolean;
  inverterId: string | null;
};

type AlertEvent = {
  id: string;
  firedAt: string;
  deliveryStatus: string;
  payload: { message?: string } | null;
};

type Broadcast = {
  id: string;
  text: string;
  status: string;
  sentCount: number;
  createdAt: string;
};

type InverterOption = { id: string; name: string };

export function TelegramPanel() {
  const [bot, setBot] = useState<BotInfo>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [inverters, setInverters] = useState<InverterOption[]>([]);
  const [token, setToken] = useState("");
  const [broadcastText, setBroadcastText] = useState("");
  const [ruleType, setRuleType] = useState<"offline" | "power_low" | "power_high">(
    "offline",
  );
  const [threshold, setThreshold] = useState("1000");
  const [ruleInverterId, setRuleInverterId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [botRes, alertRes, bcRes, invRes] = await Promise.all([
      fetch("/api/telegram/bot"),
      fetch("/api/telegram/alerts"),
      fetch("/api/telegram/broadcasts"),
      fetch("/api/inverters"),
    ]);
    if (botRes.ok) {
      const j = await botRes.json();
      setBot(j.bot);
      setWebhookUrl(j.bot?.webhookUrl ?? j.webhookUrl ?? "");
      setSubscribers(j.subscribers ?? []);
    }
    if (alertRes.ok) {
      const j = await alertRes.json();
      setRules(j.rules ?? []);
      setEvents(j.events ?? []);
    }
    if (bcRes.ok) {
      const j = await bcRes.json();
      setBroadcasts(j.broadcasts ?? []);
    }
    if (invRes.ok) {
      const j = await invRes.json();
      setInverters(
        (j.inverters ?? []).map((i: { id: string; name: string }) => ({
          id: i.id,
          name: i.name,
        })),
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function saveBot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/telegram/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: token, registerWebhook: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка сохранения");
        return;
      }
      setToken("");
      setInfo(
        data.webhookRegistered
          ? `Бот @${data.botUsername} сохранён, webhook зарегистрирован`
          : `Бот @${data.botUsername} сохранён. Webhook: ${data.webhookError ?? "не зарегистрирован (нужен HTTPS)"}`,
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeBot() {
    if (!confirm("Удалить бота и подписчиков?")) return;
    setBusy(true);
    try {
      await fetch("/api/telegram/bot", { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        type: ruleType,
        inverterId: ruleInverterId || null,
      };
      if (ruleType !== "offline") {
        body.threshold = Number(threshold);
      }
      const res = await fetch("/api/telegram/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка правила");
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleRule(id: string, enabled: boolean) {
    await fetch(`/api/telegram/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    await refresh();
  }

  async function deleteRule(id: string) {
    await fetch(`/api/telegram/alerts/${id}`, { method: "DELETE" });
    await refresh();
  }

  async function sendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/telegram/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: broadcastText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка рассылки");
        return;
      }
      setBroadcastText("");
      setInfo(
        data.result
          ? `Отправлено: ${data.result.sent}`
          : "Рассылка поставлена в очередь",
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {info && (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {info}
        </p>
      )}

      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Ваш Telegram-бот</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Создайте бота у{" "}
          <a
            href="https://t.me/BotFather"
            className="text-emerald-700 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            @BotFather
          </a>
          , вставьте токен. Платформа хранит только encrypted token и
          регистрирует webhook на ваш тенант.
        </p>

        {bot ? (
          <div className="mt-4 space-y-2 text-sm">
            <p>
              Бот:{" "}
              <span className="font-medium">
                {bot.botUsername ? `@${bot.botUsername}` : "—"}
              </span>{" "}
              · статус <span className="font-medium">{bot.status}</span>
            </p>
            <p className="break-all text-xs text-zinc-500">
              Webhook URL: {bot.webhookUrl}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={removeBot}
              className="rounded border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50"
            >
              Удалить бота
            </button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">Бот ещё не подключён.</p>
        )}

        <form onSubmit={saveBot} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="password"
            required
            minLength={20}
            placeholder="123456:ABC-DEF..."
            className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            Сохранить и зарегистрировать webhook
          </button>
        </form>
        {webhookUrl && !bot && (
          <p className="mt-2 break-all text-xs text-zinc-500">
            Ожидаемый URL: {webhookUrl}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Подписчики</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Пользователь пишет боту <code className="text-xs">/start</code> —
          появляется здесь. <code className="text-xs">/stop</code> отключает.
        </p>
        <ul className="mt-3 divide-y divide-zinc-100 text-sm">
          {subscribers.length === 0 && (
            <li className="py-2 text-zinc-500">Пока нет подписчиков</li>
          )}
          {subscribers.map((s) => (
            <li key={s.id} className="flex justify-between py-2">
              <span className="font-mono text-xs">{s.chatId}</span>
              <span className="text-zinc-500">
                {s.active ? "active" : "off"} ·{" "}
                {new Date(s.linkedAt).toLocaleString("ru-RU")}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Правила алертов</h2>
        <form onSubmit={addRule} className="mt-3 grid gap-3 sm:grid-cols-4">
          <select
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
            value={ruleType}
            onChange={(e) =>
              setRuleType(e.target.value as "offline" | "power_low" | "power_high")
            }
          >
            <option value="offline">Offline</option>
            <option value="power_low">Мощность ниже порога</option>
            <option value="power_high">Мощность выше порога</option>
          </select>
          <input
            type="number"
            className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            disabled={ruleType === "offline"}
            placeholder="Вт"
          />
          <select
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
            value={ruleInverterId}
            onChange={(e) => setRuleInverterId(e.target.value)}
          >
            <option value="">Все инверторы</option>
            {inverters.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={busy}
            className="rounded border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50"
          >
            Добавить
          </button>
        </form>
        <ul className="mt-4 divide-y divide-zinc-100 text-sm">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <span>
                {r.type}
                {r.threshold != null ? ` · ${r.threshold}` : ""}
                {!r.enabled ? " (выкл)" : ""}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded border border-zinc-300 px-2 py-1 text-xs"
                  onClick={() => toggleRule(r.id, !r.enabled)}
                >
                  {r.enabled ? "Выкл" : "Вкл"}
                </button>
                <button
                  type="button"
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-700"
                  onClick={() => deleteRule(r.id)}
                >
                  Удалить
                </button>
              </div>
            </li>
          ))}
          {!rules.length && (
            <li className="py-2 text-zinc-500">Правил пока нет</li>
          )}
        </ul>

        <h3 className="mt-6 text-sm font-medium text-zinc-800">
          Последние события
        </h3>
        <ul className="mt-2 divide-y divide-zinc-50 text-xs text-zinc-600">
          {events.slice(0, 10).map((ev) => (
            <li key={ev.id} className="py-1.5">
              {new Date(ev.firedAt).toLocaleString("ru-RU")} ·{" "}
              {ev.deliveryStatus} · {ev.payload?.message ?? "—"}
            </li>
          ))}
          {!events.length && <li className="py-1.5">Событий нет</li>}
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">
          Ручная рассылка
        </h2>
        <form onSubmit={sendBroadcast} className="mt-3 flex flex-col gap-3">
          <textarea
            required
            rows={3}
            maxLength={4000}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
            value={broadcastText}
            onChange={(e) => setBroadcastText(e.target.value)}
            placeholder="Сообщение всем активным подписчикам вашего бота"
          />
          <button
            type="submit"
            disabled={busy || !broadcastText.trim()}
            className="self-start rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            Отправить
          </button>
        </form>
        <ul className="mt-4 divide-y divide-zinc-100 text-sm">
          {broadcasts.slice(0, 8).map((b) => (
            <li key={b.id} className="py-2">
              <span className="text-zinc-500">
                {new Date(b.createdAt).toLocaleString("ru-RU")} · {b.status} ·
                sent {b.sentCount}
              </span>
              <p className="mt-0.5 line-clamp-2 text-zinc-800">{b.text}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
