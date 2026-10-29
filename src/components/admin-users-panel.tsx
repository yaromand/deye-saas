"use client";

import { useCallback, useEffect, useState } from "react";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: string;
};

export function AdminUsersPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"client" | "admin">("client");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (!res.ok) {
      setError("Нет доступа или ошибка загрузки");
      return;
    }
    const data = await res.json();
    setUsers(data.users ?? []);
    setError(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: name || undefined, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка создания");
        return;
      }
      setEmail("");
      setPassword("");
      setName("");
      setInfo(`Создан пользователь ${data.user.email}`);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: "active" | "blocked") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка");
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(id: string, userEmail: string) {
    const next = prompt(`Новый пароль для ${userEmail} (мин. 8 символов):`);
    if (!next || next.length < 8) {
      if (next != null) setError("Пароль слишком короткий");
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка сброса");
        return;
      }
      setInfo(`Пароль для ${userEmail} обновлён (значение не сохраняется в UI)`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
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
          Создать пользователя
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Секреты вендоров и Telegram-токены здесь не отображаются.
        </p>
        <form
          onSubmit={createUser}
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          <input
            type="email"
            required
            placeholder="email"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="пароль"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            placeholder="имя"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as "client" | "admin")}
          >
            <option value="client">client</option>
            <option value="admin">admin</option>
          </select>
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            Создать
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Пользователи</h2>
        {users.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Список пуст</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Роль</th>
                  <th className="py-2 pr-3">Статус</th>
                  <th className="py-2 pr-3">Создан</th>
                  <th className="py-2">Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-zinc-50">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-zinc-900">{u.email}</div>
                      {u.name && (
                        <div className="text-xs text-zinc-500">{u.name}</div>
                      )}
                    </td>
                    <td className="py-2 pr-3">{u.role}</td>
                    <td className="py-2 pr-3">{u.status}</td>
                    <td className="py-2 pr-3 text-zinc-500">
                      {new Date(u.createdAt).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        {u.status === "blocked" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setStatus(u.id, "active")}
                            className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                          >
                            Разблокировать
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setStatus(u.id, "blocked")}
                            className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                          >
                            Блокировать
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => resetPassword(u.id, u.email)}
                          className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                        >
                          Сброс пароля
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
