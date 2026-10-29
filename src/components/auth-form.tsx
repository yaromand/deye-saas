"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Mode = "login" | "register";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "register" ? { email, password, name } : { email, password },
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка");
        return;
      }
      const role = data.user?.role;
      router.push(role === "admin" ? "/admin/users" : "/dashboard");
      router.refresh();
    } catch {
      setError("Сеть недоступна");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      {mode === "register" && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600">Имя</span>
          <input
            className="rounded border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-emerald-600"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600">Email</span>
        <input
          type="email"
          required
          className="rounded border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-emerald-600"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600">Пароль</span>
        <input
          type="password"
          required
          minLength={8}
          className="rounded border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-emerald-600"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </label>
      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {loading
          ? "…"
          : mode === "login"
            ? "Войти"
            : "Зарегистрироваться"}
      </button>
    </form>
  );
}
