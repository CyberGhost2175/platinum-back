# Platinum CRM — backend

NestJS 11 + TypeORM + PostgreSQL + Redis. API prefix: `/api`. Документация: Swagger UI.

## Требования

- Docker и Docker Compose **или** Node.js 22+, PostgreSQL 16, Redis 7
- База: `platinum`, порт `5432`

## Быстрый старт (Docker)

```bash
cp .env.example .env
docker compose up --build
```

При старте контейнера `app` TypeORM сам применяет миграции (`migrationsRun: true`).

Затем seed:

```bash
docker compose exec app node dist/database/seed.js
```


### Учётные записи после seed

| Роль | Email | Пароль |
|---|---|---|
| admin | `admin@example.com` | `admin1234` |
| store_manager | `manager@example.com` | `manager12` |
| cashier | `cashier@example.com` | `cashier12` |

2FA выключена (`AUTH_2FA_ENABLED=false`). Чтобы вернуть TOTP для admin/store_manager, поставьте `true` и перезапустите.

Салон в seed: `22222222-2222-4222-8222-222222222222`.

### Если Postgres уже поднимался со старым пользователем

Тома Docker не пересоздают роль при смене `POSTGRES_USER`. Нужен новый volume:

```bash
docker compose down
docker volume rm platinum-back_postgres_data
docker compose up --build
```

Имя volume может отличаться (`docker volume ls | grep postgres`).

## Локальный запуск без контейнера app

Поднимите только инфраструктуру:

```bash
docker compose up postgres redis
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
