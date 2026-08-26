import { Location } from '../locations/entities/location.entity';
import { User } from '../users/entities/user.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Supplier } from '../products/entities/supplier.entity';
import { Product } from '../products/entities/product.entity';
import { Batch } from '../inventory/entities/batch.entity';
import { Item } from '../inventory/entities/item.entity';
import { ItemAuditLog } from '../inventory/entities/item-audit-log.entity';
import { StockCheck } from '../inventory/entities/stock-check.entity';
import { StockCheckDiscrepancy } from '../inventory/entities/stock-check-discrepancy.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { Sale } from '../sales/entities/sale.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';

export const ALL_ENTITIES = [
  Location,
  User,
  Customer,
  Supplier,
  Product,
  Batch,
  Item,
  ItemAuditLog,
  StockCheck,
  StockCheckDiscrepancy,
  Shift,
  Sale,
  SaleItem,
  Order,
  OrderItem,
  AuditLog,
];
