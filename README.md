# Platinum CRM — backend

NestJS 11 + TypeORM + PostgreSQL + Redis. API prefix: `/api`. Документация: Swagger UI.

Все настройки — из `.env`. Шаблон: `.env.example`.

## VPS (Docker)

На сервере в корне репозитория:

```bash
git clone https://github.com/CyberGhost2175/platinum-back.git
cd platinum-back
cp .env.example .env
nano .env
```

В `.env` на VPS обязательно:

- `NODE_ENV=production`
- `DB_HOST=postgres` и `REDIS_HOST=redis` (имена контейнеров, не localhost)
- свой `DB_PASSWORD`
- `SESSION_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — разные, ≥16 символов (`openssl rand -hex 32`)
- `CORS_ORIGINS=https://твой-фронт.ru`

```bash
docker compose up -d --build
docker compose exec app node dist/database/seed.js
```

Миграции накатываются сами при старте `app`.

API: `http://IP:8080/api`  
Health: `http://IP:8080/health`  
Swagger: `http://IP:8080/docs`

Postgres и Redis с хоста доступны только на `127.0.0.1` (не в интернет). Снаружи открыт порт `PORT` (по умолчанию 8080).

### Учётные записи после seed

| Роль | Email | Пароль |
|---|---|---|
| admin | `admin@example.com` | `admin1234` |
| store_manager | `manager@example.com` | `manager12` |
| cashier | `cashier@example.com` | `cashier12` |
| warehouse | `warehouse@example.com` | `warehouse12` |
| online_manager | `online@example.com` | `online1234` |

Сразу смени пароли. 2FA выключена (`AUTH_2FA_ENABLED=false`).

Если Postgres в Docker уже поднимался с другим `DB_USERNAME`, том старый:

```bash
docker compose down
docker volume ls | grep postgres
docker volume rm platinum-back_postgres_data
docker compose up -d --build
```

## Локально без Docker-приложения

Нужен свой Postgres на `5432`. В `.env`: `DB_HOST=localhost`, `REDIS_HOST=localhost`.

```bash
cp .env.example .env
npm ci
npm run migration:run
npm run seed
npm run start:dev
```

## Переменные окружения

Полный список — в `.env.example`. Кратко:

- `DB_*` — PostgreSQL
- `REDIS_*` — Redis (сессии, revoke JWT, кэш каталога/аналитики)
- `JWT_*`, `SESSION_*` — аутентификация
- `CATALOG_SEARCH_DRIVER` — `postgres` (по умолчанию) или `elasticsearch`
- `ANALYTICS_DB_*` — опциональная read-replica; без `ANALYTICS_DB_HOST` читаем с primary

## Доступ и документация API

Глобальные guards: JWT → RolesGuard → PermissionsGuard → LocationGuard.

`@RequirePermission` вешает и CRUD-проверку, и `@Roles` по матрице из `src/common/constants/permissions.ts`. У каждой операции в OpenAPI есть `x-access-roles`. Смены (`/api/shifts`) — роли admin, store_manager, cashier.

Write-эндпоинты и запрещённые комбинации роль→метод покрыты тестами в `src/common/guards/access-matrix.spec.ts` (ожидается 403).

## Безопасность ввода

- SQL: TypeORM-параметры и `$1…$n` в сырых запросах. Идентификаторы в аналитике (`date_trunc`, `GROUP BY`) — только whitelist.
- XSS: `@SanitizeText()` на именах, комментариях, промокодах, поисковой строке, бирках.

## Финансовые операции

Оплата, сторно, закрытие смены, смена статуса/перемещение изделия идут в `dataSource.transaction` с `SELECT … FOR UPDATE`. Конкурентная продажа последней единицы: второй запрос получает 400, остаток не уходит в минус (`src/sales/sales-concurrency.spec.ts`).

## Тесты

```bash
npm test
```
