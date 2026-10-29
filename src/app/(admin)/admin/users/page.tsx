import { AdminUsersPanel } from "@/components/admin-users-panel";

export const instant = false;

export default function AdminUsersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Пользователи</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600">
          Создание, блокировка и сброс пароля. Секреты вендоров и Telegram не
          показываются.
        </p>
      </div>
      <AdminUsersPanel />
    </div>
  );
}
