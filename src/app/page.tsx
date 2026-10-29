import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export const instant = false;

export default async function HomePage() {
  const session = await getSession();
  if (session.isLoggedIn) {
    redirect(session.role === "admin" ? "/admin/users" : "/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col bg-gradient-to-b from-emerald-50 via-white to-zinc-100">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5">
        <span className="text-sm font-semibold text-emerald-900">Cloud Deye</span>
        <div className="flex gap-3 text-sm">
          <Link href="/login" className="text-zinc-600 hover:text-zinc-900">
            Войти
          </Link>
          <Link
            href="/register"
            className="rounded bg-emerald-700 px-3 py-1.5 text-white hover:bg-emerald-800"
          >
            Регистрация
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 pb-24 pt-8">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-emerald-950 sm:text-5xl">
          Cloud Deye
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-zinc-600">
          Подключайте инверторы Deye / Solarman через облако вендора, смотрите
          метрики и получайте алерты в свой Telegram-бот.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/register"
            className="rounded bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Начать
          </Link>
          <Link
            href="/login"
            className="rounded border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            У меня есть аккаунт
          </Link>
        </div>
      </main>
    </div>
  );
}
