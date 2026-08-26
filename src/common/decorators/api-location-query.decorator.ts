import { ApiQuery } from '@nestjs/swagger';

export const ApiLocationQuery = () =>
  ApiQuery({
    name: 'locationId',
    required: false,
    format: 'uuid',
    description:
      'UUID точки продаж. Admin может указать любую; остальные — только свою. Если не передан, берётся locationId пользователя.',
  });
