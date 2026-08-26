import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsModule } from '../locations/locations.module';
import { Product } from '../products/entities/product.entity';
import { Supplier } from '../products/entities/supplier.entity';
import { BatchesController } from './batches.controller';
import { Batch } from './entities/batch.entity';
import { Item } from './entities/item.entity';
import { ItemAuditLog } from './entities/item-audit-log.entity';
import { StockCheck } from './entities/stock-check.entity';
import { StockCheckDiscrepancy } from './entities/stock-check-discrepancy.entity';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { ItemsController } from './items.controller';
import { StockChecksController } from './stock-checks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Item,
      Batch,
      ItemAuditLog,
      StockCheck,
      StockCheckDiscrepancy,
      Product,
      Supplier,
    ]),
    LocationsModule,
  ],
  controllers: [
    InventoryController,
    ItemsController,
    BatchesController,
    StockChecksController,
  ],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
