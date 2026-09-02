import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser } from '../auth/types/auth.types';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import {
  CrudAction,
  PermissionResource,
} from '../common/constants/permissions';
import { LocationsService } from '../locations/locations.service';
import { CatalogPromotionsQueryDto } from './dto/catalog-promotions-query.dto';
import { CatalogSearchQueryDto } from './dto/catalog-search-query.dto';
import { StockReportQueryDto } from './dto/stock-report-query.dto';
import { CatalogService } from './catalog.service';
import { ProductFilterQueryDto } from '../products/dto/product-filter-query.dto';

@ApiTags('catalog')
@ApiAuth()
@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly locations: LocationsService,
  ) {}

  @Get('dictionaries')
  @RequirePermission(PermissionResource.CATALOG, CrudAction.READ)
  @ApiOperation({
    summary: 'Справочники (металл, цвет золота, категории, остаток)',
    description:
      'goldTones — коды (red/yellow/white). goldToneOptions — те же значения с подписями: Красное / Жёлтое / Белое. Yellow не называть «золотым».',
  })
  @ApiOkResponse({ description: 'Словари каталога' })
  dictionaries() {
    return this.catalogService.dictionaries();
  }

  @Get('suppliers')
  @RequirePermission(PermissionResource.CATALOG, CrudAction.READ)
  @ApiOperation({ summary: 'Список поставщиков' })
  @ApiOkResponse({ description: 'Поставщики' })
  suppliers() {
    return this.catalogService.suppliers();
  }

  @Get('search')
  @RequirePermission(PermissionResource.CATALOG, CrudAction.READ)
  @ApiOperation({
    summary: 'Быстрый поиск для витрины и кассы',
    description:
      'Приоритет: точный артикул/штрихкод (unique index), затем название (GIN tsvector + pg_trgm), затем поставщик (pg_trgm). Драйвер: CATALOG_SEARCH_DRIVER=postgres|elasticsearch — контроллер не меняется.',
  })
  @ApiOkResponse({ description: 'Ранжированные товары с match и score' })
  search(@Query() query: CatalogSearchQueryDto) {
    return this.catalogService.search(query.q ?? '', query.limit);
  }

  @Get('stock-report')
  @RequirePermission(PermissionResource.CATALOG, CrudAction.READ)
  @ApiOperation({
    summary: 'Остатки склада в граммах',
    description:
      'Сколько металла осталось (г), разбивка по поставщикам, категориям и цвету золота. Фильтры: металл, цвет, категория, поставщик, точка, склад/витрина, поиск.',
  })
  @ApiOkResponse({ description: 'Сводка остатков' })
  async stockReport(
    @CurrentUser() user: AuthUser,
    @Query() query: StockReportQueryDto,
  ) {
    if (query.locationId) {
      await this.locations.assertAccessible(user, query.locationId);
    }
    return this.catalogService.stockReport(query);
  }

  @Get('promotions')
  @RequirePermission(PermissionResource.CATALOG, CrudAction.READ)
  @ApiOperation({
    summary: 'Товары для акций и уценки',
    description:
      'Низкий остаток (LOW_STOCK_THRESHOLD) и залежавшиеся (STALE_ITEM_DAYS). kind=low|stale сужает выдачу.',
  })
  @ApiOkResponse({ description: 'Списки lowStock и/или stale' })
  async promotions(
    @CurrentUser() user: AuthUser,
    @Query() query: CatalogPromotionsQueryDto,
  ) {
    if (query.locationId) {
      await this.locations.assertAccessible(user, query.locationId);
    }
    return this.catalogService.promotions(query);
  }

  @Get('products/low-stock')
  @RequirePermission(PermissionResource.CATALOG, CrudAction.READ)
  @ApiOperation({ summary: 'Товары с низким остатком' })
  @ApiOkResponse({ description: 'Страница товаров' })
  async lowStock(
    @CurrentUser() user: AuthUser,
    @Query() query: ProductFilterQueryDto,
  ) {
    if (query.locationId) {
      await this.locations.assertAccessible(user, query.locationId);
    }
    return this.catalogService.findLowStock(query);
  }

  @Get('products/stale')
  @RequirePermission(PermissionResource.CATALOG, CrudAction.READ)
  @ApiOperation({
    summary: 'Товары в наличии',
    deprecated: true,
    description: 'Фильтр залежки снят. То же, что GET /catalog/products.',
  })
  @ApiOkResponse({ description: 'Страница товаров' })
  async stale(
    @CurrentUser() user: AuthUser,
    @Query() query: ProductFilterQueryDto,
  ) {
    if (query.locationId) {
      await this.locations.assertAccessible(user, query.locationId);
    }
    const { stale: _stale, ...filters } = query;
    return this.catalogService.findProducts(filters);
  }

  @Get('products')
  @RequirePermission(PermissionResource.CATALOG, CrudAction.READ)
  @ApiOperation({
    summary: 'Каталог товаров с фильтрами',
    description:
      'Фильтры: категория изделия, металл, оттенок золота, поставщик, цена, локация, статус остатка. Пагинация и сортировка (name, price, sku, createdAt, availableQty).',
  })
  @ApiOkResponse({ description: 'Страница товаров с availableQty и stale' })
  async findProducts(
    @CurrentUser() user: AuthUser,
    @Query() query: ProductFilterQueryDto,
  ) {
    if (query.locationId) {
      await this.locations.assertAccessible(user, query.locationId);
    }
    return this.catalogService.findProducts(query);
  }

  @Get('products/:id/stock')
  @RequirePermission(PermissionResource.CATALOG, CrudAction.READ)
  @ApiOperation({
    summary: 'Остатки товара по локациям',
    description:
      'Доступно / на складе / на витрине / всего единиц. Кассир видит только доступные ему точки.',
  })
  @ApiParam({ name: 'id', description: 'UUID или артикул PT-000001' })
  @ApiOkResponse({ description: 'Остатки по точкам' })
  stockByLocation(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.catalogService.stockByLocation(id, user);
  }

  @Get('products/:id')
  @RequirePermission(PermissionResource.CATALOG, CrudAction.READ)
  @ApiOperation({ summary: 'Карточка товара каталога' })
  @ApiParam({ name: 'id', description: 'UUID или артикул PT-000001' })
  @ApiOkResponse({ description: 'Товар с остатком' })
  findOne(@Param('id') id: string) {
    return this.catalogService.findById(id);
  }
}
