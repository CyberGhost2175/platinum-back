import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemAuditLog } from '../inventory/entities/item-audit-log.entity';
import { Item } from '../inventory/entities/item.entity';
import { LocationsModule } from '../locations/locations.module';
import { Product } from '../products/entities/product.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { ShiftsModule } from '../shifts/shifts.module';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      SaleItem,
      Item,
      Product,
      ItemAuditLog,
      Shift,
    ]),
    LocationsModule,
    ShiftsModule,
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
