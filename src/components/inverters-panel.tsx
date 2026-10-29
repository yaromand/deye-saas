"use client";

import { useCallback, useEffect, useState } from "react";
import { MetricsSparkline } from "./metrics-sparkline";

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
  const [busy, setBusy] = useState(false);
  const [vendor, setVendor] = useState<"solarman" | "deye">("solarman");
  const [label, setLabel] = useState("");
  const [creds, setCreds] = useState(emptyCreds);
  const [manualSn, setManualSn] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualAccountId, setManualAccountId] = useState("");

  const activeAdapter = adapters.find((a) => a.id === vendor);

  const refresh = useCallback(async () => {
    const [aRes, iRes] = await Promise.all([
      fetch("/api/vendor-accounts"),
      fetch("/api/inverters"),
    ]);
    if (!aRes.ok || !iRes.ok) {
      setError("Не удалось загрузить данные (нужна авторизация и БД)");
      return;
    }
    const aJson = await aRes.json();
    const iJson = await iRes.json();
    setAccounts(aJson.accounts ?? []);
    setInverters(iJson.inverters ?? []);
    if (!manualAccountId && aJson.accounts?.[0]?.id) {
      setManualAccountId(aJson.accounts[0].id);
    }
  }, [manualAccountId]);

  const loadMetrics = useCallback(async (id: string) => {
    const res = await fetch(`/api/inverters/${id}/metrics?limit=200`);
    if (!res.ok) return;
    const json = await res.json();
    setPoints(json.points ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (selectedId) void loadMetrics(selectedId);
  }, [selectedId, loadMetrics]);

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
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
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function syncOne(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/inverters/${id}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? data.result?.error ?? "Ошибка sync");
        return;
      }
      await refresh();
      await loadMetrics(id);
      setSelectedId(id);
    } finally {
      setBusy(false);
    }
  }

  async function syncAll() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/inverters/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка sync");
        return;
      }
      await refresh();
      if (selectedId) await loadMetrics(selectedId);
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

  const powerSeries = points
    .map((p) => p.powerW)
    .filter((v): v is number => v != null);

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">
          Аккаунт вендора (Solarman / Deye)
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Секреты шифруются at-rest (`ENCRYPTION_KEY`). Без полного набора
          полей адаптер работает в stub-режиме (синтетические метрики).
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
              ["password", "Пароль (хранится encrypted; в API — SHA-256)"],
              ["accessToken", "Access token (опционально, вместо логина)"],
              ["baseUrl", "Base URL (по умолчанию globalapi.solarmanpv.com)"],
              ["stationId", "Station ID (опционально)"],
              ["orgId", "Org / company ID (опционально)"],
            ] as const
          ).map(([key, title]) => (
            <label key={key} className="flex flex-col gap-1 text-sm sm:col-span-1">
              <span className="text-zinc-600">{title}</span>
              <input
                type={
                  key === "password" || key === "appSecret" || key === "accessToken"
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
            disabled={busy || !inverters.length}
            onClick={syncAll}
            className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            Синхронизировать все
          </button>
        </div>

        <form
          onSubmit={addManual}
          className="mt-4 grid gap-3 sm:grid-cols-4"
        >
          <label className="flex flex-col gap-1 text-sm sm:col-span-1">
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

        <ul className="mt-4 divide-y divide-zinc-100 text-sm">
          {inverters.length === 0 && (
            <li className="py-3 text-zinc-500">Пока нет инверторов</li>
          )}
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
                <span className="font-medium text-zinc-900">{inv.name}</span>
                <span className="mt-0.5 block text-xs text-zinc-500">
                  {inv.externalDeviceId} · {inv.vendor} · {inv.status}
                  {inv.lastSeenAt
                    ? ` · ${new Date(inv.lastSeenAt).toLocaleString("ru-RU")}`
                    : ""}
                </span>
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => syncOne(inv.id)}
                  className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-50"
                >
                  Sync
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

      {selectedId && (
        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-base font-semibold text-zinc-900">
            Метрики (мощность)
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Последние точки из `telemetry_points` (после Sync или worker).
          </p>
          <div className="mt-4">
            <MetricsSparkline values={powerSeries} />
          </div>
          <div className="mt-4 overflow-x-auto">
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
                {[...points].reverse().slice(0, 40).map((p, i) => (
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
                    <td colSpan={4} className="py-3 text-zinc-500">
                      Нет данных — нажмите Sync
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
