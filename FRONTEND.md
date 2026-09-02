# Platinum CRM — контракт для фронтенда

База: `http://localhost:8080`  
Префикс API: **`/api`** (кроме health)  
Swagger UI: [http://localhost:8080/docs](http://localhost:8080/docs)  
OpenAPI JSON: [http://localhost:8080/docs-json](http://localhost:8080/docs-json)

Все защищённые запросы:

```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Деньги:

| Где | Единица | Тип в JSON |
|---|---|---|
| `Product.price`, `Product.costPrice` | **рубли** | строка `"45990.00"` |
| чек, позиция, смена (`totalAmount`, `discount`, `cashTotal`…) | **копейки** | строка `"150000"` (= 1500 ₽) |

---

## 1. Что к чему относится (доменная карта)

Это не «микросервисы», это **слои одной CRM**. Фронт должен держать в голове три уровня товара и кассовый контур.

```
Поставщик (Supplier)
    └── Товар-SKU (Product)          ← артикул = штрихкод, цена, металл, категория
            └── Физическая единица (Item)  ← уникальная бирка uniqueTag
                    ├── живёт на Локации (Location): склад → салон → витрина
                    └── появляется из Партии приёмки (Batch)

Кассир (User) открывает Смену (Shift) на Локации
    └── Черновик чека (Sale status=draft)
            └── Позиции (SaleItem) → ссылаются на Item + Product
                    └── POST .../pay  →  Sale status=paid, Item status=sold
                            └── сторно  →  Sale status=refunded, Item снова in_stock

Клиент (Customer) — опционально на чеке и на онлайн-заказе (Order)
```

| Сущность | Это что | Для какого экрана |
|---|---|---|
| **User** | сотрудник: роль, точка, 2FA | логин, шапка, админка пользователей |
| **Location** | склад / салон / витрина (дерево `parentId`) | выбор точки, остатки, смена |
| **Supplier** | поставщик | карточка товара, приёмка |
| **Product** | номенклатура (SKU), не конкретное кольцо в сейфе | каталог, карточка, цена |
| **Item** | одно физическое изделие с биркой | склад, касса (скан бирки), перемещения |
| **Batch** | акт приёмки: пачка Item от поставщика | склад «приёмка» |
| **StockCheck** | инвентаризация: сверка бирок | склад «ревизия» |
| **Shift** | кассовая смена кассира на точке | касса: открыть/закрыть |
| **Sale** | чек (черновик → оплачен → сторно) | касса, история продаж |
| **SaleItem** | строка чека | корзина кассы |
| **Customer** | клиент салона | чек, CRM клиентов |
| **Order** | онлайн-заказ (пока только список) | отдел online |
| **Analytics** | отчёты по оплаченным чекам | дашборды директора |

**Product vs Item:**  
`GET /catalog/products` — витрина SKU.  
`GET /items` — конкретные кольца/цепи с бирками. На кассе в чек кладётся **Item** (или `productId` + qty — бэк сам резервирует свободные бирки).

**Products vs Catalog:**  
`/api/products` — складской CRUD (создать SKU, цена, удалить).  
`/api/catalog` — витрина/касса: поиск, фильтры, остатки по точкам, акции. Читать каталог можно почти всем ролям; менять товар — нет.

**Inventory vs Items:**  
`/api/inventory` — короткие алиасы. Основной UI склада лучше строить на `/api/items`, `/api/batches`, `/api/stock-checks`.

---

## 2. Роли → какие экраны показывать

| Роль | Экраны | Не пускать |
|---|---|---|
| `cashier` | касса (смена + чек), каталог/поиск, клиенты (чтение) | создание товаров, приёмка, сторно, пользователи, аналитика |
| `store_manager` | касса (чтение/сторно), склад CRUD, каталог, аналитика своей точки, клиенты | создание пользователей; **не может сам пробить чек** (нет SALES CREATE) |
| `warehouse` | приёмка, статусы, перемещения, каталог (чтение) | касса, смены, аналитика, пользователи |
| `online_manager` | каталог, онлайн-заказы, клиенты, аналитика канала `online` | офлайн-касса, смены, склад write |
| `admin` | всё | — |

2FA сейчас **выключена** (`AUTH_2FA_ENABLED=false`). Все роли логинятся только email+пароль.

Матрица CRUD (C/R/U/D):

| Ресурс | admin | store_manager | cashier | online_manager | warehouse |
|---|---|---|---|---|---|
| товары/склад | CRUD | CRUD | R | R | CRU |
| продажи | CRUD | RU | CR | R | — |
| онлайн-заказы | CRUD | R | — | CRUD | R |
| клиенты | CRUD | RU | CR | CRU | — |
| пользователи | CRUD | — | — | — | — |
| каталог | CRUD | RU | R | R | R |
| аналитика | R | R | — | R | — |

403 = нет права. 401 = нет/протух JWT.

`locationId` в query: кассир и менеджер салона видят **свою точку и дочерние** (витрины). Admin и warehouse — любую. Чужую точку → 403.

---

## 3. Экраны фронта → какие эндпоинты звать

### Логин
1. `POST /api/auth/login` `{ email, password }`
2. При `status: "ok"` сохрани `accessToken` + `refreshToken`, пользователь в `user`.
   (Ветки `totp_required` / `totp_enrollment` появятся только если бэк включит `AUTH_2FA_ENABLED=true`.)
3. Шапка и оболочка роли: `GET /api/auth/me` — ФИО, точка, `roleMeta` (лейбл, цвет, меню), `permissions`, `workspace`.
   Изменить свои ФИО / телефон / email: `PATCH /api/auth/me`. Точку себе меняет только admin.
4. Обновление: `POST /api/auth/refresh` `{ refreshToken }`
5. Выход: `POST /api/auth/logout` `{ refreshToken }`

Bootstrap после seed: `admin@example.com` / `admin1234`. Демо-каталог и салоны не создаются — точку и товары заводят в UI.

### Касса
```
GET  /api/shifts/current          → есть ли открытая смена
POST /api/shifts/open             → если нет (locationId опционален)
GET  /api/catalog/search?q=       → скан артикула / поиск названия
POST /api/sales/drafts            → новый чек (нужна открытая смена)
POST /api/sales/drafts/:id/items  → { itemId } или { productId, qty, priceMinor? }
PATCH /api/sales/drafts/:id       → скидка / промо SALE10 | VIP500
POST /api/sales/drafts/:id/pay    → { paymentMethod: "cash"|"card" }
POST /api/shifts/:id/close        → в конце дня (нельзя, если есть draft)
```

Сторно (менеджер/админ, смена ещё открыта): `POST /api/sales/:id/refund`.

### Склад
```
POST /api/batches                 → приёмка { supplierId, locationId?, items: [{ productId, uniqueTag }] }
GET  /api/items                   → список бирок
POST /api/items/:id/move          → { locationId, comment? }
PATCH /api/items/:id/status       → ремонт / чистка / комиссия / витрина
POST /api/stock-checks            → { locationId, scannedTags: string[] }
```

Создать SKU: `POST /api/products` (артикул можно не слать — выдастся `PT-000001`). Сменить цену: `PATCH /api/products/:id/price`. `id` в путях — UUID **или** артикул.

### Админ: сотрудники, склады, поставщики
```
GET    /api/users
POST   /api/users
GET    /api/users/:id
PATCH  /api/users/:id
PATCH  /api/users/:id/password
DELETE /api/users/:id

GET    /api/locations                 → дерево точек (admin/warehouse — все)
POST   /api/locations                 → { name, type, parentId? }
PATCH  /api/locations/:id
DELETE /api/locations/:id             → 409, если есть дети/люди/товары/продажи

GET    /api/suppliers                 → все, включая неактивных
POST   /api/suppliers                 → { name, phone?, email? }
PATCH  /api/suppliers/:id             → можно isActive=false
DELETE /api/suppliers/:id             → 409, если есть товары/партии
GET    /api/catalog/suppliers         → только активные (касса/витрина)
```

Write по складам и поставщикам — только **admin** (`settings`). Сотрудники — только admin (`users`).

### Витрина / каталог
```
GET /api/catalog/dictionaries     → enums для фильтров
GET /api/catalog/suppliers
GET /api/catalog/products         → фильтры + пагинация
GET /api/catalog/products/:id
GET /api/catalog/products/:id/stock
GET /api/catalog/promotions       → низкий остаток
```

### Аналитика (admin / store_manager / online_manager)
```
GET /api/analytics/summary|revenue|categories|margin|sellers|inventory
GET /api/analytics/export?report=revenue&format=xlsx
```
Query: `period=day|week|month|year`, `from`, `to`, `locationId`, `channel=offline|online`.

---

## 4. Все эндпоинты

Auth: **JWT**, если не указано Public.

### health — без `/api`
| Метод | Путь | Auth | Зачем |
|---|---|---|---|
| GET | `/health` | Public | Postgres + Redis живы |

### auth
| Метод | Путь | Auth | Роли | Body / query | Зачем |
|---|---|---|---|---|---|
| POST | `/api/auth/register` | Public | — | `RegisterDto` | регистрация **кассира** |
| POST | `/api/auth/login` | Public | — | `{ email, password }` | логин, сразу JWT |
| POST | `/api/auth/login/2fa` | Public | — | `{ challengeId, code }` | сейчас 400 (2FA выключена) |
| POST | `/api/auth/2fa/setup` | JWT | любой | — | сейчас 400 |
| POST | `/api/auth/2fa/enable` | JWT | любой | `{ challengeId, code }` | сейчас 400 |
| POST | `/api/auth/2fa/disable` | JWT | не admin/manager | `{ code }` | выключить TOTP |
| POST | `/api/auth/refresh` | Public | — | `{ refreshToken }` | новая пара токенов |
| POST | `/api/auth/logout` | Public | — | `{ refreshToken }` | отозвать refresh |
| POST | `/api/auth/logout-all` | JWT | свой | — | все сессии |
| POST | `/api/auth/forgot-password` | Public | — | `{ email }` | код сброса (`devToken` не в production) |
| POST | `/api/auth/reset-password` | Public | — | `{ token, newPassword }` | новый пароль |
| PATCH | `/api/auth/password` | JWT | свой | `{ password }` (≥8) | сменить свой пароль (сессии отзываются) |
| GET | `/api/auth/me` | JWT | свой | — | профиль роли: ФИО, точка, меню, права, workspace |
| PATCH | `/api/auth/me` | JWT | свой | `UpdateProfileDto` | изменить ФИО, телефон, email; `locationId` — только admin |

Ответ логина (`status`):

```ts
{ status: "ok", accessToken, refreshToken, expiresIn, user }
```

Пока `AUTH_2FA_ENABLED=false`, других статусов логина нет.

`user`: `{ id, email, role, locationId }`.  
`me`: `id`, `email`, `phone`, `firstName`, `lastName`, `displayName`, `role`, `status`, `locationId`, `totpEnabled`, `location` `{ id, name, type, parentId } | null`, `roleMeta` `{ label, title, description, accent, nav[] }`, `permissions` `{ [resource]: ["C"|"R"|"U"|"D"] }`, `workspace`:
- admin → `{ home, location, counts: { users, locations, suppliers, products } }`
- store_manager → `{ home, location, subtreeLocationIds }`
- cashier → `{ home, location, currentShift }`
- warehouse → `{ home, location, defaultWarehouse }`
- online_manager → `{ home, location, channel: "online" }`

`roleMeta.nav` — пункты меню (href/icon) под шапку. Цвет роли: `roleMeta.accent`.

### users — только admin
| Метод | Путь | Зачем | Body |
|---|---|---|---|
| GET | `/api/users` | список с `location` (без hash/secret) | — |
| POST | `/api/users` | создать сотрудника | `CreateUserDto` |
| GET | `/api/users/:id` | карточка | — |
| PATCH | `/api/users/:id` | email, ФИО, роль, телефон, точка, статус | `UpdateUserDto` |
| PATCH | `/api/users/:id/password` | задать пароль (в т.ч. себе) | `{ password }` (≥8) |
| DELETE | `/api/users/:id` | удалить | — |

`CreateUserDto`: `email`, `password` (≥8), `firstName`, `lastName`, `role`, `phone?`, `locationId?`, `status?`.  
`UpdateUserDto`: все поля опциональны: `email`, `firstName`, `lastName`, `role`, `phone?`, `locationId?`, `status?`.

Нельзя удалить себя, последнего admin и пользователя с продажами/сменами/инвентаризациями — в этом случае блокируйте аккаунт (`status: blocked`). Смена пароля отзывает все сессии.

### locations — склады / салоны / витрины
Чтение: все роли с каталогом (кассир видит свою точку и дочерние). Write: **admin**.

| Метод | Путь | Зачем | Body |
|---|---|---|---|
| GET | `/api/locations` | список точек (`parent` подгружен) | — |
| POST | `/api/locations` | создать | `{ name, type: warehouse\|store\|display, parentId? }` |
| GET | `/api/locations/:id` | карточка | — |
| PATCH | `/api/locations/:id` | имя, тип, родитель | все поля опциональны; `parentId: null` снимает родителя |
| DELETE | `/api/locations/:id` | удалить пустую точку | — |

Цикл в дереве (точка → сама себе / потомок) → 400. Непустая точка → 409.

`PATCH /api/auth/me` с `locationId` назначает точку текущему admin. Остальные роли точку себе не меняют — её задаёт admin в сотрудниках.

### suppliers — поставщики
Список для кассы: `GET /api/catalog/suppliers` (только `isActive`). CRUD ниже — **admin**.

| Метод | Путь | Зачем | Body |
|---|---|---|---|
| GET | `/api/suppliers` | все, включая неактивных | `?includeInactive=false` — только активные |
| POST | `/api/suppliers` | создать | `{ name, phone?, email? }` |
| GET | `/api/suppliers/:id` | карточка | — |
| PATCH | `/api/suppliers/:id` | имя, контакты, `isActive` | — |
| DELETE | `/api/suppliers/:id` | удалить | 409, если есть товары или партии — тогда `isActive: false` |

### products — складской CRUD SKU
Роли write: admin, store_manager; warehouse — C/U (без DELETE). Кассир — только GET.

| Метод | Путь | Зачем |
|---|---|---|
| GET | `/api/products` | список + фильтры (см. query ниже) |
| GET | `/api/products/search?q=` | поиск SKU/имя/поставщик |
| POST | `/api/products` | создать SKU |
| GET | `/api/products/:id` | карточка + `availableQty` (UUID или артикул) |
| PATCH | `/api/products/:id` | обновить |
| PATCH | `/api/products/:id/price` | `{ price: "45990.00" \| null }` |
| DELETE | `/api/products/:id` | удалить, если нет Item |

Query списка (`ProductFilterQueryDto`): `page`, `limit`, `metalCategory`, `itemCategory`, `goldTone`, `supplierId`, `locationId`, `priceMin`, `priceMax`, `stockStatus`, `q` (артикул, имя, поставщик, вес, цена, металл, категория, цвет золота), `sortBy=name\|price\|createdAt\|sku\|availableQty\|weight\|supplier`, `sortOrder=ASC\|DESC`. Параметр `stale` игнорируется — фильтра залежки нет.

`CreateProductDto`: `sku?` (если нет — сервер выдаст `PT-000001`, `PT-000002`, …), `name`, `weight` (строка граммов `"2.350"`), `metalCategory`, `goldTone?` (только для gold), `itemCategory`, `supplierId`, `price?`, `costPrice?`, `qty?` (сколько единиц положить на склад, по умолчанию **1**), `locationId?` (точка; иначе склад / первая локация). Без единиц товар не попадает в `stockStatus=in_stock` и на кассу. UUID товара (`id`) внутренний; на бирках и в UI показывайте `sku`.

### catalog — витрина (чтение)
Роли: все кроме «никто»; write каталога на этих путях нет.

| Метод | Путь | Зачем |
|---|---|---|
| GET | `/api/catalog/dictionaries` | enums для селектов; `goldToneOptions`: `{ value, label }` (`yellow` → «Жёлтое», не «Золотое») |
| GET | `/api/catalog/suppliers` | поставщики |
| GET | `/api/catalog/search?q=&limit=` | быстрый поиск кассы/витрины |
| GET | `/api/catalog/stock-report` | остатки в граммах: металл, поставщики, категории, топ/низ изделий. Query: `metalCategory`, `itemCategory`, `goldTone`, `supplierId`, `locationId`, `scope=available\|in_stock\|on_display`, `q`, `productLimit`. Фильтра залежки нет. |
| GET | `/api/catalog/promotions` | low stock (`kind=low`) |
| GET | `/api/catalog/products` | те же фильтры, что у products |
| GET | `/api/catalog/products/low-stock` | низкий остаток |
| GET | `/api/catalog/products/:id` | карточка |
| GET | `/api/catalog/products/:id/stock` | остатки **по локациям** |

### items — физические единицы
Write: admin, store_manager, warehouse.

| Метод | Путь | Зачем | Body |
|---|---|---|---|
| GET | `/api/items` | список бирок | query: `page`, `limit`, `locationId`, `productId`, `status` |
| GET | `/api/items/:id` | карточка | — |
| GET | `/api/items/:id/history` | журнал движения | — |
| PATCH | `/api/items/:id/status` | статус | `{ status, comment? }` |
| POST | `/api/items/:id/move` | переместить | `{ locationId, comment? }` |

Продажу через status **не делать** — только модуль sales.

### inventory — алиасы склада
| Метод | Путь | То же что |
|---|---|---|
| GET | `/api/inventory` | урезанный список изделий |
| GET | `/api/inventory/stock` | сводка остатков по точке |
| PATCH | `/api/inventory/:id/status` | `PATCH /api/items/:id/status` |

### batches — приёмка
| Метод | Путь | Зачем |
|---|---|---|
| POST | `/api/batches` | создать партию + Item на складе |
| GET | `/api/batches/:id` | партия с составом |

Body: `{ supplierId, locationId?, items: [{ productId, uniqueTag }] }`. Бирка уникальна.

### stock-checks — инвентаризация
| Метод | Путь | Зачем |
|---|---|---|
| GET | `/api/stock-checks` | акты точки (`locationId`) |
| POST | `/api/stock-checks` | сверка `{ locationId, scannedTags[], note? }` → missing/extra |
| GET | `/api/stock-checks/:id` | акт с расхождениями |

### shifts — касса, смена
Только **admin, store_manager, cashier**.

| Метод | Путь | Зачем |
|---|---|---|
| POST | `/api/shifts/open` | открыть `{ locationId? }` |
| GET | `/api/shifts/current` | текущая открытая + итоги + чеки |
| POST | `/api/shifts/:id/close` | закрыть (ошибка, если есть draft) |
| GET | `/api/shifts` | список точки |
| GET | `/api/shifts/:id` | смена + `summary` + `receipts` |

`summary`: `cashTotal`, `cardTotal`, `grandTotal`, `receiptsCount`, `averageCheck`, `soldItemsCount` (копейки).

Один кассир — только одна открытая смена.

### sales — чеки
CREATE (черновик/оплата): **admin, cashier**.  
UPDATE (сторно): **admin, store_manager**.  
READ: admin, store_manager, cashier, online_manager.

| Метод | Путь | Зачем | Body |
|---|---|---|---|
| POST | `/api/sales/drafts` | новый draft | `{ customerId?, locationId? }` |
| PATCH | `/api/sales/drafts/:id` | скидка чека | `{ customerId?, discountMinor?, discountPercent?, promoCode? }` |
| POST | `/api/sales/drafts/:id/items` | строка | `{ itemId? }` **или** `{ productId?, qty? }` + `priceMinor?` + скидки/промо |
| PATCH | `/api/sales/drafts/:id/items/:lineId` | цена / скидка строки | `{ qty?, priceMinor?, discountMinor?, discountPercent?, promoCode? }` |
| DELETE | `/api/sales/drafts/:id/items/:lineId` | убрать строку | — |
| DELETE | `/api/sales/drafts/:id` | отменить draft | 204 |
| POST | `/api/sales/drafts/:id/pay` | оплатить | `{ paymentMethod: "cash"\|"card" }` |
| POST | `/api/sales/:id/refund` | сторно | `{ reason? }` |
| GET | `/api/sales` | чеки точки | `locationId` |
| GET | `/api/sales/:id` | один чек | — |

Промо: `SALE10` (10%), `VIP500` (500 ₽ = 50000 коп.).  
`discountMinor` и `priceMinor` — копейки. Если у товара нет цены, строка создаётся с `0`, цену можно указать в чеке. После pay чек не редактируется. Два параллельных pay последней единицы: второй → **400**.

### customers
Сейчас только список. Write API клиентов ещё нет (роль CREATE в матрице — на будущее).

| Метод | Путь | Роли |
|---|---|---|
| GET | `/api/customers` | admin, store_manager, cashier, online_manager |

### orders — онлайн
Write API заказов ещё нет.

| Метод | Путь | Роли |
|---|---|---|
| GET | `/api/orders` | admin, store_manager, online_manager, warehouse |

### analytics
Роли: admin (всё), store_manager (своё дерево точек), online_manager (`channel=online`).

| Метод | Путь | Зачем |
|---|---|---|
| GET | `/api/analytics/summary` | KPI за период |
| GET | `/api/analytics/revenue` | выручка по корзинам/точкам/каналам |
| GET | `/api/analytics/categories` | топ, `groupBy=itemCategory\|metalCategory\|priceSegment` |
| GET | `/api/analytics/margin` | маржа, `level=product\|receipt` |
| GET | `/api/analytics/sellers` | рейтинг кассиров |
| GET | `/api/analytics/inventory` | оборачиваемость, неликвиды |
| GET | `/api/analytics/export` | файл: `report` + `format=xlsx\|pdf` |

Общий query: `period`, `from`, `to`, `locationId`, `channel`, `groupBy`, `level`, `limit`.

---

## 5. Сущности (поля, которые приходят с бэка)

Имена в JSON — **camelCase**.

### User
`id`, `role`, `status` (`active`\|`blocked`), `email`, `phone`, `firstName`, `lastName`, `totpEnabled`, `locationId`, `location?`, `createdAt`, `updatedAt`  
Не отдаём: `passwordHash`, `totpSecret`.

### Location
`id`, `type` (`warehouse`\|`store`\|`display`), `name`, `parentId`  
Дерево: склад → салон → витрина.

### Supplier
`id`, `name`, `phone`, `email`, `isActive`

### Product
`id` (UUID, внутренний), `sku` (читаемый артикул, новые — `PT-000001`), `name`, `weight`, `metalCategory`, `goldTone`, `itemCategory`, `supplierId`, `price`, `costPrice`, `outOfStock`, `createdAt`, `updatedAt`  
В списках каталога ещё: `availableQty`, `stale`.

### Item
`id`, `uniqueTag`, `productId`, `locationId`, `batchId`, `status`, `createdAt`, `updatedAt`  
`status`: `in_stock` | `on_display` | `sold` | `in_repair` | `in_cleaning` | `on_commission`

### ItemAuditLog (история)
`id`, `itemId`, `action`, `fromStatus`, `toStatus`, `fromLocationId`, `toLocationId`, `actorUserId`, `payload`, `createdAt`

### Batch
`id`, `supplierId`, `receivedAt`, `documents[]`, `items[]`

### StockCheck + StockCheckDiscrepancy
Акт: `id`, `date`, `locationId`, `responsibleUserId`  
Расхождение: `kind` = `missing` | `extra`, `uniqueTag`, `itemId`, `productId`, `expectedQty`, `actualQty`, `note`

### Shift
`id`, `cashierId`, `locationId`, `status` (`open`\|`closed`), `openedAt`, `closedAt`, `cashTotal`, `cardTotal`  
В `current`/`getById` ещё `summary`, `receipts`.

### Sale
`id`, `date`, `receiptNumber`, `locationId`, `sellerId`, `shiftId`, `customerId`, `paymentMethod` (`cash`\|`card`\|null), `channel` (`offline`\|`online`), `status` (`draft`\|`paid`\|`refunded`), `promoCode`, `discountPercent`, `discount`, `totalAmount`, `originalSaleId`, `items[]`

Номер чека после оплаты: `YYYYMMDD-{8 hex locationId}-{seq}`.

### SaleItem
`id`, `saleId`, `productId`, `itemId`, `qty`, `price`, `discount`, `discountPercent`, `promoCode`, `lineTotal`  
`price` / `lineTotal` — копейки.

### Customer
`id`, `fullName`, `phone`, `email`, `loyaltyPoints`, `notes`

### Order
`id`, `customerId`, `status` (`new`\|`confirmed`\|`assembled`\|`shipped`\|`delivered`\|`cancelled`), `totalAmount` (копейки), `deliveryInfo`, `paymentInfo`, `comment`, `items[]`

---

## 6. Справочники (enums)

Бери живые значения с `GET /api/catalog/dictionaries`, ниже — контракт.

```
metalCategory:   gold | silver | diamonds
goldTone:        red | yellow | white          // только если metal = gold
goldToneOptions: { value, label }[]
                 red → Красное, yellow → Жёлтое, white → Белое
                 (yellow — жёлтое, не «золотое»)
itemCategory:    rings | earrings | studs | necklaces | bracelets | chains
stockStatus:     in_stock | out_of_stock | low
userRole:        admin | store_manager | cashier | online_manager | warehouse
```

Пагинация списков: `{ data, total, page, limit }` (где используется `PaginationQueryDto`). По умолчанию `page=1`, `limit=20`, max 100.

---

## 7. Типовые ошибки для UI

| HTTP | Когда |
|---|---|
| 400 | нет смены / пустой чек / товар out of stock / смена уже закрыта / повторный pay / draft при close |
| 401 | нет JWT, протух access, неверный пароль/TOTP |
| 403 | роль не та или чужая `locationId` |
| 404 | сущность не найдена |
| 409 | email занят, бирка уже есть, изделие уже в другом draft |

Конкурентная продажа последней бирки: первый pay — 200, второй — 400, остаток не уходит в минус. Показать тост с `message` из тела ошибки Nest (`{ statusCode, message }`).

---

## 8. Минимальный набор экранов по ролям

| Экран | cashier | store_manager | warehouse | online_manager | admin |
|---|---|---|---|---|---|
| Логин | + | + | + | + | + |
| Касса (смена + чек) | + | просмотр + сторно | — | — | + |
| Каталог / поиск | + | + | + | + | + |
| Склад (бирки, приёмка) | чтение | + | + | — | + |
| Клиенты | список | список | — | список | список |
| Онлайн-заказы | — | список | список | список | список |
| Аналитика | — | своя точка | — | online | всё |
| Пользователи | — | — | — | — | + |

Живой Swagger всегда каноничнее этого файла, если что-то разъедется: http://localhost:8080/docs
