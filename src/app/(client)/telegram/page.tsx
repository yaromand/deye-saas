import { TelegramPanel } from "@/components/telegram-panel";

export const instant = false;

export default function TelegramPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Telegram</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600">
          Подключите своего бота (BotFather), настройте алерты offline / пороги
          мощности и отправляйте ручные рассылки подписчикам.
        </p>
      </div>
      <TelegramPanel />
    </div>
  );
}
