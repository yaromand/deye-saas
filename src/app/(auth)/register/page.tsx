import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Регистрация</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Создаёт клиентский тенант (один пользователь = один тенант)
        </p>
      </div>
      <AuthForm mode="register" />
      <p className="text-center text-sm text-zinc-500">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="text-emerald-700 hover:underline">
          Войти
        </Link>
      </p>
    </div>
  );
}
