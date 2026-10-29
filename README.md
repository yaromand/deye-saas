# Cloud Deye

Мультиарендная SaaS-платформа для мониторинга солнечных инверторов через **облако вендора** (Solarman / Deye и др.). Локальный Modbus не используется.

Стек: **Next.js (App Router) + TypeScript + Postgres (Drizzle) + Redis (BullMQ)**.

## Что уже есть (фаза 1 — scaffold)

- Регистрация / логин (session cookie, роли `admin` | `client`)
- Маршруты клиента: дашборд, инверторы, Telegram (заглушки UI)
- Маршрут админа: пользователи (заглушка)
- Схема БД: users, vendor_accounts, inverters, telemetry_points, alert_*, telegram_*, broadcasts
- Redis-клиент и entrypoint воркеров polling / Telegram (stubs)
- Интерфейс vendor adapter + stub Solarman/Deye
- `docker-compose` для Postgres + Redis

Полный polling API, графики и живой Telegram — в следующих фазах.

## Требования

- Node.js 20+
- Docker (для Postgres и Redis)

## Быстрый старт

```bash
# 1. Инфраструктура
docker compose up -d

# 2. Переменные окружения
cp .env.example .env
# при необходимости отредактируйте AUTH_SECRET и ENCRYPTION_KEY

# 3. Зависимости
npm install

# 4. Миграции Drizzle
npm run db:migrate

# 5. Веб-приложение
npm run dev

# 6. (опционально) воркеры в отдельном терминале
npm run worker
```

Откройте [http://localhost:3000](http://localhost:3000).

## Скрипты

| Команда | Назначение |
|---------|------------|
| `npm run dev` | Next.js в режиме разработки |
| `npm run build` / `npm start` | production-сборка и запуск |
| `npm run worker` | BullMQ workers (polling + Telegram stubs) |
| `npm run db:generate` | сгенерировать SQL-миграции из схемы |
| `npm run db:migrate` | применить миграции |
| `npm run db:studio` | Drizzle Studio |
| `npm run lint` | ESLint |

## Структура

```
src/app/(auth)       — login / register
src/app/(client)     — dashboard, inverters, telegram
src/app/(admin)      — admin/users
src/lib/db           — Drizzle schema + client
src/lib/auth         — session (iron-session) + password
src/lib/vendors      — VendorAdapter + Solarman/Deye stub
src/lib/redis.ts     — Redis client
workers/             — polling.ts, telegram.ts, index.ts
drizzle/             — SQL-миграции
docker-compose.yml   — Postgres 16 + Redis 7
```

## Мультитенантность

На MVP **один пользователь = один тенант** (`tenant_id === user.id`). Все бизнес-таблицы несут `tenant_id`; API берёт его только из сессии, не из тела запроса.

## Админ

Первого администратора пока нужно создать вручную (обновить `role` в таблице `users` на `admin` после регистрации) — CRUD админки появится в фазе 3.

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

## Безопасность

- Пароли: bcrypt
- Сессия: httpOnly cookie (`AUTH_SECRET`)
- Секреты вендоров и Telegram: at-rest AES-GCM (`ENCRYPTION_KEY`)
- Реальные vendor/Telegram токены в репозиторий не кладём
