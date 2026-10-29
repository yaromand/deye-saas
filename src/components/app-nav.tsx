"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const clientLinks = [
  { href: "/dashboard", label: "Дашборд" },
  { href: "/inverters", label: "Инверторы" },
  { href: "/telegram", label: "Telegram" },
];

const adminLinks = [{ href: "/admin/users", label: "Пользователи" }];

export function AppNav({
  role,
  email,
}: {
  role?: string;
  email?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const links = role === "admin" ? adminLinks : clientLinks;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold tracking-tight text-emerald-800">
            Cloud Deye
          </Link>
          <nav className="flex gap-3 text-sm">
            {links.map((l) => {
              const active = pathname === l.href || pathname.startsWith(l.href + "/");
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={
                    active
                      ? "font-medium text-emerald-800"
                      : "text-zinc-600 hover:text-zinc-900"
                  }
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-zinc-600">
          {email && <span className="hidden sm:inline">{email}</span>}
          <button
            type="button"
            onClick={logout}
            className="rounded border border-zinc-300 px-2.5 py-1 hover:bg-zinc-50"
          >
            Выйти
          </button>
        </div>
      </div>
    </header>
  );
}
