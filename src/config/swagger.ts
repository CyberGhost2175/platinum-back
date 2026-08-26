import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  CrudAction,
  PermissionResource,
  ROLE_PERMISSIONS,
} from '../common/constants/permissions';
import { UserRole } from '../common/enums/user-role.enum';

export const SWAGGER_PATH = 'docs';

function matrixMarkdown(): string {
  const lines = [
    '### Матрица доступа (RolesGuard + PermissionsGuard)',
    '',
    '| Ресурс | admin | store_manager | cashier | online_manager | warehouse |',
    '|---|---|---|---|---|---|',
  ];
  for (const resource of Object.values(PermissionResource)) {
    const row = ROLE_PERMISSIONS[resource];
    const cell = (role: UserRole) => (row[role] ?? []).join('') || '—';
    lines.push(
      `| \`${resource}\` | ${cell(UserRole.ADMIN)} | ${cell(UserRole.STORE_MANAGER)} | ${cell(UserRole.CASHIER)} | ${cell(UserRole.ONLINE_MANAGER)} | ${cell(UserRole.WAREHOUSE)} |`,
    );
  }
  lines.push('');
  lines.push(
    `CRUD: ${CrudAction.CREATE}=создать, ${CrudAction.READ}=читать, ${CrudAction.UPDATE}=изменить, ${CrudAction.DELETE}=удалить.`,
  );
  lines.push(
    'У каждого защищённого эндпоинта в OpenAPI есть расширение `x-access-roles`.',
  );
  lines.push(
    'Смены (`/api/shifts`): admin, store_manager, cashier. Возврат чека — SALES UPDATE (admin, store_manager).',
  );
  return lines.join('\n');
}

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Platinum CRM')
    .setDescription(
      [
        'Backend CRM ювелирного салона.',
        '',
        'Авторизация: кнопка **Authorize** → JWT access-токен (`Authorization: Bearer`).',
        '2FA сейчас выключена. Чтобы вернуть TOTP для admin/store_manager, поставьте AUTH_2FA_ENABLED=true.',
        'Эндпоинты с `locationId`: admin/warehouse видят любую точку, остальные — только свою цепочку локаций.',
        '',
        matrixMarkdown(),
      ].join('\n\n'),
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access-токен из POST /api/auth/login или /api/auth/login/2fa',
      },
      'bearer',
    )
    .addTag('health', 'Проверка Postgres и Redis')
    .addTag('auth', 'Регистрация, логин, 2FA, refresh, сброс пароля')
    .addTag('users', 'Пользователи (только admin)')
    .addTag('locations', 'Склады, салоны, витрины')
    .addTag('suppliers', 'Поставщики (CRUD — admin)')
    .addTag('products', 'Товары: CRUD, фильтры, залежавшиеся')
    .addTag('items', 'Физические единицы: статус, перемещение, история')
    .addTag('batches', 'Приёмка партий')
    .addTag('stock-checks', 'Инвентаризация и акты расхождений')
    .addTag('inventory', 'Сводка остатков')
    .addTag('sales', 'Офлайн-продажи: черновик, оплата, сторно')
    .addTag('shifts', 'Кассовые смены')
    .addTag('orders', 'Онлайн-заказы')
    .addTag('customers', 'Клиенты')
    .addTag('catalog', 'Витрина, поиск, остатки по точкам')
    .addTag('analytics', 'Дашборды, маржа, экспорт Excel/PDF')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey}_${methodKey}`,
  });
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    useGlobalPrefix: false,
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'method',
      displayRequestDuration: true,
    },
  });
}
