import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Item } from '../inventory/entities/item.entity';
import { LocationsModule } from '../locations/locations.module';
import { ProductsModule } from '../products/products.module';
import { Supplier } from '../products/entities/supplier.entity';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CatalogSearchModule } from './search/catalog-search.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Supplier, Item]),
    LocationsModule,
    CatalogSearchModule,
    ProductsModule,
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
