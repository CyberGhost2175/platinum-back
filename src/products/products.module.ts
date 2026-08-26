import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogSearchModule } from '../catalog/search/catalog-search.module';
import { Item } from '../inventory/entities/item.entity';
import { LocationsModule } from '../locations/locations.module';
import { Product } from './entities/product.entity';
import { Supplier } from './entities/supplier.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Supplier, Item]),
    LocationsModule,
    CatalogSearchModule,
  ],
  controllers: [ProductsController, SuppliersController],
  providers: [ProductsService, SuppliersService],
  exports: [ProductsService, SuppliersService, TypeOrmModule],
})
export class ProductsModule {}
