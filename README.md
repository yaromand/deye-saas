# Cloud Deye

Мультиарендная SaaS-платформа для мониторинга солнечных инверторов через **облако вендора** (Solarman / Deye и др.). Локальный Modbus не используется.

Стек: **Next.js (App Router) + TypeScript + Postgres (Drizzle) + Redis (BullMQ)**.

## Статус фаз

| Фаза | Содержание | Статус |
|------|------------|--------|
| 1 — Scaffold | Auth, роли, layouts, схема БД | ✅ |
| 2 — Ingest | Solarman/Deye adapter, polling, telemetry API/UI | ✅ (этот PR) |
| 3 — UI polish / admin | Расширенные графики, админ CRUD | later |
| 4 — Telegram | Бот, алерты, broadcasts | later |

## Быстрый старт

```bash
docker compose up -d
cp .env.example .env
# задайте AUTH_SECRET (≥32) и ENCRYPTION_KEY (≥16)
npm install
npm run db:migrate
npm run dev          # http://localhost:3000
npm run worker       # отдельный терминал: polling + Telegram stubs
```

## Solarman / Deye credentials

Официальная документация: [Solarman OpenAPI](https://doc.solarmanpv.com/en/Documentation%20and%20Quick%20Guide).

Deye Cloud обычно ходит в **тот же** Solarman Open API.

### Базовые URL

| Дата-центр | URL |
|------------|-----|
| International (по умолчанию) | `https://globalapi.solarmanpv.com` |
| China | `https://api.solarmanpv.com` |

### Поля (форма «Инверторы» / `vendor_accounts.credentials`)

| Поле | Обязательно | Описание |
|------|-------------|----------|
| `appId` | да* | APP ID приложения Open Platform |
| `appSecret` | да* | APP Secret |
| `password` | да* | Пароль аккаунта Solarman (хранится encrypted; в token-запросе — SHA-256) |
| `email` / `username` / `mobile` | да* (одно из) | Логин аккаунта |
| `accessToken` | нет | Если задан — логин пропускается |
| `baseUrl` | нет | Переопределение API host |
| `stationId` | нет | Ограничить discovery одной станцией |
| `orgId` | нет | Merchant / company ID |
| `countryCode` | нет | Нужен при логине по `mobile` |

\* Без полного набора адаптер **не ходит в сеть** и отдаёт stub-метрики (удобно для локальной разработки). Секреты в репозиторий не кладём.

### Используемые API

1. `POST /account/v1.0/token?appId=` — OAuth-like token (password = SHA-256)
2. `POST /station/v1.0/list` — список станций
3. `POST /station/v1.0/device` — устройства станции (`deviceType: INVERTER`)
4. `POST /device/v1.0/list` — fallback-список устройств
5. `POST /device/v1.0/currentData` — realtime (`deviceSn`)
6. `POST /device/v1.0/historical` — история для графиков

Как получить APP ID/Secret: заявка в Solarman Open Platform (см. Quick Guide / `service@solarmanpv.com`).

## API клиента (tenant из сессии)

| Метод | Путь | Назначение |
|-------|------|------------|
| GET/POST | `/api/vendor-accounts` | Список / добавить аккаунт |
| DELETE | `/api/vendor-accounts/:id` | Удалить |
| GET/POST | `/api/inverters` | Список / добавить или `discover: true` |
| DELETE | `/api/inverters/:id` | Удалить |
| POST | `/api/inverters/:id/sync` | Опрос одного + enqueue BullMQ |
| POST | `/api/inverters/sync` | Опрос всех инверторов тенанта |
| GET | `/api/inverters/:id/metrics?from=&to=` | Точки для графика/таблицы |

## Воркер

`npm run worker` поднимает BullMQ consumer `poll-inverter` и раз в `POLL_INTERVAL_MS` (по умолчанию 5 мин) ставит jobs на все активные инверторы. UI Sync работает и **без** worker (inline poll).

## Мультитенантность

`tenant_id === user.id` на MVP. API никогда не принимает чужой `tenant_id` из тела — только из сессии. Секреты вендоров: AES-GCM (`ENCRYPTION_KEY`).

## Админ

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

## Известные ограничения

- **Felicity** — адаптер не реализован (нет стабильной публичной доки в срок MVP).
- Ключи realtime (`Pac`, `Etdy_ge1`, …) зависят от point table устройства; парсер покрывает типичные имена.
- Rate limits Solarman: не крутите polling чаще 1–5 мин на устройство.
- Токен Solarman живёт ~60 дней; refresh flow — later.
