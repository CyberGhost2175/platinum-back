import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import {
  CrudAction,
  PermissionResource,
} from '../common/constants/permissions';
import { AuthUser } from '../auth/types/auth.types';
import { LocationsService } from '../locations/locations.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductFilterQueryDto } from './dto/product-filter-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductPriceDto } from './dto/update-product-price.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@ApiAuth()
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly locations: LocationsService,
  ) {}

  @Get()
  @RequirePermission(PermissionResource.PRODUCTS_INVENTORY, CrudAction.READ)
  @ApiOperation({
    summary: 'Список товаров с фильтрами и пагинацией',
    description:
      'Фильтры: металл, категория, оттенок, поставщик, цена, локация, статус остатка, залежавшиеся. Сортировка: sortBy + sortOrder.',
  })
  @ApiOkResponse({ description: 'Страница товаров с availableQty и stale' })
  async findMany(
    @CurrentUser() user: AuthUser,
    @Query() query: ProductFilterQueryDto,
  ) {
    if (query.locationId) {
      await this.locations.assertAccessible(user, query.locationId);
    }
    return this.productsService.findMany(query);
  }

  @Get('search')
  @RequirePermission(PermissionResource.PRODUCTS_INVENTORY, CrudAction.READ)
  @ApiOperation({
    summary: 'Поиск товара по SKU, названию или поставщику',
    description: 'Тот же движок, что GET /catalog/search (артикул точно, затем FTS/триграммы).',
  })
  @ApiOkResponse({ description: 'Найденные товары' })
  search(@Query('q') query: string) {
    return this.productsService.search(query ?? '');
  }

  @Get('stale')
  @RequirePermission(PermissionResource.PRODUCTS_INVENTORY, CrudAction.READ)
  @ApiOperation({
    summary: 'Залежавшиеся товары',
    description: 'Единицы в наличии старше STALE_ITEM_DAYS (по умолчанию 180).',
  })
  findStale(@Query() query: ProductFilterQueryDto) {
    return this.productsService.findMany({ ...query, stale: true });
  }

  @Post()
  @RequirePermission(PermissionResource.PRODUCTS_INVENTORY, CrudAction.CREATE)
  @AuditLog('products')
  @ApiOperation({
    summary: 'Создать товар',
    description:
      'Артикул (sku) можно не передавать — выдаётся PT-000001, PT-000002, … UUID остаётся внутренним id.',
  })
  @ApiCreatedResponse({ description: 'Созданный товар' })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Get(':id')
  @RequirePermission(PermissionResource.PRODUCTS_INVENTORY, CrudAction.READ)
  @ApiOperation({ summary: 'Карточка товара с остатком' })
  @ApiParam({ name: 'id', description: 'UUID или артикул PT-000001' })
  findOne(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @Patch(':id')
  @RequirePermission(PermissionResource.PRODUCTS_INVENTORY, CrudAction.UPDATE)
  @AuditLog('products')
  @ApiOperation({ summary: 'Обновить товар' })
  @ApiParam({ name: 'id', description: 'UUID или артикул PT-000001' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Patch(':id/price')
  @RequirePermission(PermissionResource.PRODUCTS_INVENTORY, CrudAction.UPDATE)
  @AuditLog('product_price')
  @ApiOperation({ summary: 'Изменить цену товара' })
  @ApiParam({ name: 'id', description: 'UUID или артикул PT-000001' })
  updatePrice(@Param('id') id: string, @Body() dto: UpdateProductPriceDto) {
    return this.productsService.updatePrice(id, dto.price ?? null);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PermissionResource.PRODUCTS_INVENTORY, CrudAction.DELETE)
  @AuditLog('products')
  @ApiOperation({
    summary: 'Удалить товар',
    description: 'Только Admin и Store Manager. Нельзя удалить, если есть Item.',
  })
  @ApiParam({ name: 'id', description: 'UUID или артикул PT-000001' })
  @ApiNoContentResponse()
  async remove(@Param('id') id: string): Promise<void> {
    await this.productsService.remove(id);
  }
}
