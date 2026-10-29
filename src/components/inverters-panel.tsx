"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MetricsChart, StatusBadge } from "./metrics-chart";

type Account = {
  id: string;
  vendor: string;
  label: string | null;
  status: string;
};

type Inverter = {
  id: string;
  name: string;
  externalDeviceId: string;
  status: string;
  lastSeenAt: string | null;
  vendorAccountId: string;
  vendor: string;
  meta?: Record<string, unknown> | null;
};

type MetricPoint = {
  ts: string;
  powerW: number | null;
  energyKwh: number | null;
  soc: number | null;
};

type AdapterInfo = {
  id: string;
  credentialFields: {
    required: string[];
    optional: string[];
    notes: string;
  };
};

type RangeKey = "1h" | "6h" | "24h" | "7d";

const RANGES: { key: RangeKey; label: string; ms: number }[] = [
  { key: "1h", label: "1 ч", ms: 60 * 60 * 1000 },
  { key: "6h", label: "6 ч", ms: 6 * 60 * 60 * 1000 },
  { key: "24h", label: "24 ч", ms: 24 * 60 * 60 * 1000 },
  { key: "7d", label: "7 дн", ms: 7 * 24 * 60 * 60 * 1000 },
];

const emptyCreds = {
  appId: "",
  appSecret: "",
  email: "",
  username: "",
  password: "",
  accessToken: "",
  baseUrl: "",
  stationId: "",
  orgId: "",
};

export function InvertersPanel({ adapters }: { adapters: AdapterInfo[] }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [inverters, setInverters] = useState<Inverter[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [points, setPoints] = useState<MetricPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ok" | "error">(
    "loading",
  );
  const [range, setRange] = useState<RangeKey>("24h");
  const [vendor, setVendor] = useState<"solarman" | "deye">("solarman");
  const [label, setLabel] = useState("");
  const [creds, setCreds] = useState(emptyCreds);
  const [manualSn, setManualSn] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualAccountId, setManualAccountId] = useState("");

  const activeAdapter = adapters.find((a) => a.id === vendor);
  const selected = inverters.find((i) => i.id === selectedId) ?? null;

  const refresh = useCallback(async () => {
    setLoadState("loading");
    try {
      const [aRes, iRes] = await Promise.all([
        fetch("/api/vendor-accounts"),
        fetch("/api/inverters"),
      ]);
      if (!aRes.ok || !iRes.ok) {
        setError("Не удалось загрузить данные (нужна авторизация и БД)");
        setLoadState("error");
        return;
      }
      const aJson = await aRes.json();
      const iJson = await iRes.json();
      setAccounts(aJson.accounts ?? []);
      setInverters(iJson.inverters ?? []);
      setManualAccountId((prev) => prev || aJson.accounts?.[0]?.id || "");
      setLoadState("ok");
      setError(null);
    } catch {
      setError("Сеть недоступна");
      setLoadState("error");
    }
  }, []);

  const loadMetrics = useCallback(
    async (id: string, rangeKey: RangeKey) => {
      const ms = RANGES.find((r) => r.key === rangeKey)?.ms ?? RANGES[2].ms;
      const to = new Date();
      const from = new Date(to.getTime() - ms);
      const res = await fetch(
        `/api/inverters/${id}/metrics?from=${from.toISOString()}&to=${to.toISOString()}&limit=1000`,
      );
      if (!res.ok) {
        setPoints([]);
        return;
      }
      const json = await res.json();
      setPoints(json.points ?? []);
    },
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (selectedId) void loadMetrics(selectedId, range);
  }, [selectedId, range, loadMetrics]);

  const chartLabels = useMemo(
    () =>
      points.map((p) =>
        new Date(p.ts).toLocaleString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
      ),
    [points],
  );

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/vendor-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor,
          label: label || undefined,
          credentials: creds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка сохранения аккаунта");
        return;
      }
      setCreds(emptyCreds);
      setLabel("");
      setInfo("Аккаунт вендора сохранён");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeAccount(id: string) {
    if (!confirm("Удалить аккаунт вендора и связанные инверторы?")) return;
    setBusy(true);
    try {
      await fetch(`/api/vendor-accounts/${id}`, { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function discover(accountId: string) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/inverters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorAccountId: accountId, discover: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка discovery");
        return;
      }
      setInfo(
        `Найдено устройств: ${data.discovered ?? 0}, обновлено: ${(data.created ?? []).length}`,
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualAccountId || !manualSn) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/inverters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorAccountId: manualAccountId,
          externalDeviceId: manualSn,
          name: manualName || manualSn,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка добавления");
        return;
      }
      setManualSn("");
      setManualName("");
      setInfo("Инвертор добавлен");
      await refresh();
      if (data.inverter?.id) setSelectedId(data.inverter.id);
    } finally {
      setBusy(false);
    }
  }

  async function syncOne(id: string) {
    setSyncingId(id);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/inverters/${id}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.result?.ok === false) {
        setError(
          data.error ?? data.result?.error ?? "Ошибка синхронизации",
        );
        return;
      }
      const r = data.result;
      setInfo(
        `Sync OK: ${r.status ?? "—"}${r.powerW != null ? `, ${Math.round(r.powerW)} Вт` : ""}${r.stub ? " (stub)" : ""}`,
      );
      await refresh();
      setSelectedId(id);
      await loadMetrics(id, range);
    } catch {
      setError("Сеть недоступна при sync");
    } finally {
      setSyncingId(null);
    }
  }

  async function syncAll() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/inverters/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка sync");
        return;
      }
      const results = data.results ?? [];
      const ok = results.filter((r: { ok: boolean }) => r.ok).length;
      setInfo(`Синхронизировано: ${ok}/${results.length}`);
      await refresh();
      if (selectedId) await loadMetrics(selectedId, range);
    } finally {
      setBusy(false);
    }
  }

  async function removeInverter(id: string) {
    if (!confirm("Удалить инвертор?")) return;
    setBusy(true);
    try {
      await fetch(`/api/inverters/${id}`, { method: "DELETE" });
      if (selectedId === id) {
        setSelectedId(null);
        setPoints([]);
      }
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
        <h2 className="text-base font-semibold text-zinc-900">
          Аккаунт вендора (Solarman / Deye)
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Секреты шифруются at-rest (`ENCRYPTION_KEY`). Без полного набора
          полей — stub-метрики.
        </p>
        {activeAdapter && (
          <p className="mt-2 text-xs text-zinc-500">
            Обязательно: {activeAdapter.credentialFields.required.join(", ")}.{" "}
            {activeAdapter.credentialFields.notes}
          </p>
        )}

        <form onSubmit={addAccount} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600">Вендор</span>
            <select
              className="rounded border border-zinc-300 px-3 py-2"
              value={vendor}
              onChange={(e) => setVendor(e.target.value as "solarman" | "deye")}
            >
              <option value="solarman">Solarman</option>
              <option value="deye">Deye</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600">Метка</span>
            <input
              className="rounded border border-zinc-300 px-3 py-2"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Дом / дача"
            />
          </label>
          {(
            [
              ["appId", "App ID"],
              ["appSecret", "App Secret"],
              ["email", "Email аккаунта"],
              ["username", "Username (если нет email)"],
              ["password", "Пароль"],
              ["accessToken", "Access token (опционально)"],
              ["baseUrl", "Base URL"],
              ["stationId", "Station ID"],
              ["orgId", "Org ID"],
            ] as const
          ).map(([key, title]) => (
            <label key={key} className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600">{title}</span>
              <input
                type={
                  key === "password" ||
                  key === "appSecret" ||
                  key === "accessToken"
                    ? "password"
                    : "text"
                }
                className="rounded border border-zinc-300 px-3 py-2"
                value={creds[key]}
                onChange={(e) =>
                  setCreds((c) => ({ ...c, [key]: e.target.value }))
                }
                autoComplete="off"
              />
            </label>
          ))}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              Сохранить аккаунт
            </button>
          </div>
        </form>

        {accounts.length > 0 && (
          <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100 pt-3 text-sm">
            {accounts.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span>
                  <span className="font-medium">{a.label ?? a.vendor}</span>{" "}
                  <span className="text-zinc-500">({a.vendor})</span>
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => discover(a.id)}
                    className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-50"
                  >
                    Найти устройства
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => removeAccount(a.id)}
                    className="rounded border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50"
                  >
                    Удалить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-900">Инверторы</h2>
          <button
            type="button"
            disabled={busy || !inverters.length || syncingId != null}
            onClick={syncAll}
            className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {busy ? "Синхронизация…" : "Синхронизировать все"}
          </button>
        </div>

        <form onSubmit={addManual} className="mt-4 grid gap-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600">Аккаунт</span>
            <select
              className="rounded border border-zinc-300 px-3 py-2"
              value={manualAccountId}
              onChange={(e) => setManualAccountId(e.target.value)}
              required
            >
              <option value="">—</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label ?? a.vendor}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600">Device SN</span>
            <input
              className="rounded border border-zinc-300 px-3 py-2"
              value={manualSn}
              onChange={(e) => setManualSn(e.target.value)}
              required
              placeholder="серийный номер"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600">Имя</span>
            <input
              className="rounded border border-zinc-300 px-3 py-2"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-60"
            >
              Добавить вручную
            </button>
          </div>
        </form>

        {loadState === "loading" && (
          <p className="mt-4 text-sm text-zinc-500">Загрузка…</p>
        )}
        {loadState === "error" && !inverters.length && (
          <p className="mt-4 rounded border border-dashed border-zinc-300 bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
            Не удалось загрузить список. Проверьте сессию и DATABASE_URL.
          </p>
        )}
        {loadState === "ok" && inverters.length === 0 && (
          <p className="mt-4 rounded border border-dashed border-zinc-300 bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
            Пока нет инверторов — сохраните аккаунт вендора и нажмите «Найти
            устройства» или добавьте SN вручную.
          </p>
        )}

        <ul className="mt-4 divide-y divide-zinc-100 text-sm">
          {inverters.map((inv) => (
            <li
              key={inv.id}
              className={`flex flex-wrap items-center justify-between gap-2 py-3 ${
                selectedId === inv.id ? "bg-emerald-50/60" : ""
              }`}
            >
              <button
                type="button"
                className="text-left"
                onClick={() => setSelectedId(inv.id)}
              >
                <span className="flex items-center gap-2 font-medium text-zinc-900">
                  {inv.name}
                  <StatusBadge status={inv.status} />
                </span>
                <span className="mt-0.5 block text-xs text-zinc-500">
                  {inv.externalDeviceId} · {inv.vendor}
                  {inv.lastSeenAt
                    ? ` · ${new Date(inv.lastSeenAt).toLocaleString("ru-RU")}`
                    : " · ещё не синхронизирован"}
                </span>
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || syncingId != null}
                  onClick={() => syncOne(inv.id)}
                  className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-50 disabled:opacity-60"
                >
                  {syncingId === inv.id ? "Sync…" : "Sync"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeInverter(inv.id)}
                  className="rounded border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50"
                >
                  Удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {selected && (
        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">
                {selected.name}
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                SN {selected.externalDeviceId} · <StatusBadge status={selected.status} />
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRange(r.key)}
                  className={`rounded px-2.5 py-1 text-xs ${
                    range === r.key
                      ? "bg-emerald-700 text-white"
                      : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium text-zinc-800">
                Мощность
              </h3>
              <MetricsChart
                labels={chartLabels}
                unit="Вт"
                series={[
                  {
                    label: "Power",
                    values: points.map((p) => p.powerW),
                    color: "#047857",
                  },
                ]}
              />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-zinc-800">
                Энергия
              </h3>
              <MetricsChart
                labels={chartLabels}
                unit="кВт·ч"
                series={[
                  {
                    label: "Energy",
                    values: points.map((p) => p.energyKwh),
                    color: "#0f766e",
                  },
                ]}
              />
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="py-2 pr-3">Время</th>
                  <th className="py-2 pr-3">Вт</th>
                  <th className="py-2 pr-3">кВт·ч</th>
                  <th className="py-2">SOC %</th>
                </tr>
              </thead>
              <tbody>
                {[...points]
                  .reverse()
                  .slice(0, 50)
                  .map((p, i) => (
                    <tr key={`${p.ts}-${i}`} className="border-b border-zinc-50">
                      <td className="py-1.5 pr-3 text-zinc-600">
                        {new Date(p.ts).toLocaleString("ru-RU")}
                      </td>
                      <td className="py-1.5 pr-3">{p.powerW ?? "—"}</td>
                      <td className="py-1.5 pr-3">{p.energyKwh ?? "—"}</td>
                      <td className="py-1.5">{p.soc ?? "—"}</td>
                    </tr>
                  ))}
                {!points.length && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-zinc-500">
                      Нет точек — нажмите Sync или дождитесь worker
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
