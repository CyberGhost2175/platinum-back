import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import {
  CrudAction,
  PermissionResource,
} from '../common/constants/permissions';
import { AuthUser } from '../auth/types/auth.types';
import { AnalyticsService } from './analytics.service';
import { AnalyticsExportService } from './analytics-export.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AnalyticsExportQueryDto } from './dto/analytics-export-query.dto';

@ApiTags('analytics')
@ApiAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly exportService: AnalyticsExportService,
  ) {}

  @Get('summary')
  @RequirePermission(PermissionResource.ANALYTICS, CrudAction.READ)
  @ApiOperation({
    summary: 'Краткая сводка',
    description:
      'Admin — все точки и каналы; Store Manager — своя точка (с витринами); Online Manager — только online.',
  })
  @ApiOkResponse({ description: 'Сводка за период' })
  summary(
    @CurrentUser() user: AuthUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.summary(user, query);
  }

  @Get('revenue')
  @RequirePermission(PermissionResource.ANALYTICS, CrudAction.READ)
  @ApiOperation({
    summary: 'Дашборд выручки',
    description:
      'Периоды day/week/month/year, разбивка по точкам и каналам. Чтение с MV + Redis TTL.',
  })
  @ApiOkResponse({ description: 'Выручка по корзинам, точкам и каналам' })
  revenue(
    @CurrentUser() user: AuthUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.revenue(user, query);
  }

  @Get('categories')
  @RequirePermission(PermissionResource.ANALYTICS, CrudAction.READ)
  @ApiOperation({
    summary: 'Топ продаж',
    description: 'groupBy=itemCategory|metalCategory|priceSegment (budget/mid/premium).',
  })
  @ApiOkResponse({ description: 'Топ групп' })
  categories(
    @CurrentUser() user: AuthUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.categories(user, query);
  }

  @Get('margin')
  @RequirePermission(PermissionResource.ANALYTICS, CrudAction.READ)
  @ApiOperation({
    summary: 'Маржинальность',
    description:
      'level=product|receipt. Себестоимость — products.costPrice (nullable). Суммы в копейках.',
  })
  @ApiOkResponse({ description: 'Маржа по позициям или чекам' })
  margin(
    @CurrentUser() user: AuthUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.margin(user, query);
  }

  @Get('sellers')
  @RequirePermission(PermissionResource.ANALYTICS, CrudAction.READ)
  @ApiOperation({ summary: 'Рейтинг продавцов по выручке и числу чеков' })
  @ApiOkResponse({ description: 'Рейтинг' })
  sellers(
    @CurrentUser() user: AuthUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.sellers(user, query);
  }

  @Get('inventory')
  @RequirePermission(PermissionResource.ANALYTICS, CrudAction.READ)
  @ApiOperation({
    summary: 'Оборачиваемость склада и неликвиды',
    description: 'Залежавшиеся товары — индикатор STALE_ITEM_DAYS из модуля склада.',
  })
  @ApiOkResponse({ description: 'Остатки, продажи, неликвиды' })
  inventory(
    @CurrentUser() user: AuthUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.inventory(user, query);
  }

  @Get('export')
  @RequirePermission(PermissionResource.ANALYTICS, CrudAction.READ)
  @ApiOperation({
    summary: 'Экспорт отчёта',
    description: 'format=xlsx (exceljs) или pdf (pdfkit). report=revenue|categories|margin|sellers|inventory.',
  })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf',
  )
  @ApiOkResponse({ description: 'Файл отчёта' })
  async export(
    @CurrentUser() user: AuthUser,
    @Query() query: AnalyticsExportQueryDto,
  ) {
    const file = await this.exportService.export(user, query);
    return new StreamableFile(file.buffer, {
      type: file.contentType,
      disposition: `attachment; filename="${file.filename}"`,
    });
  }
}
