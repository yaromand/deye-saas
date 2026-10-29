# Cloud Deye

Мультиарендная SaaS-платформа для мониторинга солнечных инверторов через **облако вендора** (Solarman / Deye и др.). Локальный Modbus не используется.

Стек: **Next.js (App Router) + TypeScript + Postgres (Drizzle) + Redis (BullMQ)**.

## Статус фаз

| Фаза | Содержание | Статус |
|------|------------|--------|
| 1 — Scaffold | Auth, роли, layouts, схема БД | ✅ |
| 2 — Ingest | Solarman/Deye adapter, polling, telemetry | ✅ |
| 3 — UI / admin | Графики, sync UX, админ users | ✅ |
| 4 — Telegram | Свой бот, webhook, алерты, broadcasts | ✅ |

## Быстрый старт

```bash
docker compose up -d
cp .env.example .env
# задайте AUTH_SECRET (≥32), ENCRYPTION_KEY (≥16), NEXT_PUBLIC_APP_URL
npm install
npm run db:migrate
npm run dev          # http://localhost:3000
npm run worker       # polling + Telegram delivery
```

Для webhook Telegram нужен **публичный HTTPS** URL в `NEXT_PUBLIC_APP_URL` (например tunnel: `cloudflared` / `ngrok`).

## Solarman / Deye credentials

Документация: [Solarman OpenAPI](https://doc.solarmanpv.com/en/Documentation%20and%20Quick%20Guide). Deye использует тот же контур.

| Дата-центр | URL |
|------------|-----|
| International (по умолчанию) | `https://globalapi.solarmanpv.com` |
| China | `https://api.solarmanpv.com` |

**Live:** `appId` + `appSecret` + `password` + (`email` \| `username` \| `mobile`).  
**Опционально:** `accessToken`, `baseUrl`, `stationId`, `orgId`.  
Без полного набора — stub-метрики. Секреты шифруются (`ENCRYPTION_KEY`).

Endpoints: `/account/v1.0/token`, `/station/v1.0/list|device`, `/device/v1.0/list|currentData|historical`.

## Telegram (свой бот на тенант)

### BotFather

1. Откройте [@BotFather](https://t.me/BotFather) → `/newbot` → получите токен вида `123456:ABC…`.
2. В Cloud Deye: **Telegram** → вставьте токен → «Сохранить и зарегистрировать webhook».
3. Токен хранится **только encrypted**; в админке и логах не показывается.
4. Пользователи пишут боту `/start` (подписка) или `/stop` (отписка).
5. Алерты (offline / порог мощности) и ручные broadcasts уходят активным `chat_id`.

### Webhook

- URL: `{NEXT_PUBLIC_APP_URL}/api/telegram/{tenantId}`
- Заголовок проверки: `X-Telegram-Bot-Api-Secret-Token` (секрет задаётся при `setWebhook`)
- Локально без HTTPS Telegram отклонит `setWebhook` — поднимите tunnel и пропишите HTTPS в `NEXT_PUBLIC_APP_URL`, затем сохраните токен снова.

Альтернатива без публичного URL: worker long-poll (`getUpdates`) — не в MVP; сейчас основной путь — webhook + очередь BullMQ (`send-alert`, `broadcast`). Sync/API умеют доставлять inline, если Redis недоступен.

## API (кратко)

| Область | Пути |
|---------|------|
| Vendor / ingest | `/api/vendor-accounts`, `/api/inverters`, `…/sync`, `…/metrics` |
| Telegram | `/api/telegram/bot`, `/api/telegram/alerts`, `/api/telegram/broadcasts`, webhook `/api/telegram/[tenantId]` |
| Admin | `/api/admin/users` (GET/POST), `/api/admin/users/[id]` (PATCH: block/reset) |

Все клиентские данные фильтруются по `tenant_id` из сессии.

## Админ

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

Или создайте админа из UI после первого SQL-promote. Блокировка и сброс пароля — в `/admin/users`.

## Ограничения

- Felicity adapter — нет публичной доки
- Webhook требует HTTPS; без него бот сохраняется, но статус может быть `error`
- Solarman point-table keys различаются по устройствам
- Rate limits: polling ≥1–5 мин; Telegram ~20 msg/s (есть лёгкий throttle в broadcast)
