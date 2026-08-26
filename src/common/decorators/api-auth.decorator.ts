import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

export const ApiAuth = () =>
  applyDecorators(
    ApiBearerAuth('bearer'),
    ApiUnauthorizedResponse({ description: 'Нет или невалидный JWT access-токен' }),
    ApiForbiddenResponse({
      description:
        'Недостаточно прав (RolesGuard / матрица CRUD). Смотрите x-access-roles у операции. Либо доступ к чужой точке продаж.',
    }),
  );
