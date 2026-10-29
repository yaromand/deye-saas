import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Вход</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Войдите в аккаунт клиента или администратора
        </p>
      </div>
      <AuthForm mode="login" />
      <p className="text-center text-sm text-zinc-500">
        Нет аккаунта?{" "}
        <Link href="/register" className="text-emerald-700 hover:underline">
          Регистрация
        </Link>
      </p>
    </div>
  );
}
