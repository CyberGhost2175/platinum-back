import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { StockDiscrepancyKind } from '../enums/stock-discrepancy-kind.enum';
import { Item } from './item.entity';
import { StockCheck } from './stock-check.entity';

@Entity('stock_check_discrepancies')
@Index('IDX_stock_check_discrepancies_stock_check_id', ['stockCheckId'])
@Index('IDX_stock_check_discrepancies_item_id', ['itemId'])
@Index('IDX_stock_check_discrepancies_product_id', ['productId'])
export class StockCheckDiscrepancy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => StockCheck, (stockCheck) => stockCheck.discrepancies, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'stock_check_id' })
  stockCheck: StockCheck;

  @Column({ name: 'stock_check_id', type: 'uuid' })
  stockCheckId: string;

  @ManyToOne(() => Item, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'item_id' })
  item: Item | null;

  @Column({ name: 'item_id', type: 'uuid', nullable: true })
  itemId: string | null;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'product_id' })
  product: Product | null;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId: string | null;

  @Column({
    type: 'enum',
    enum: StockDiscrepancyKind,
    enumName: 'stock_discrepancy_kind',
    default: StockDiscrepancyKind.MISSING,
  })
  kind: StockDiscrepancyKind;

  @Column({ name: 'unique_tag', type: 'varchar', length: 64, nullable: true })
  uniqueTag: string | null;

  @Column({ name: 'expected_qty', type: 'int' })
  expectedQty: number;

  @Column({ name: 'actual_qty', type: 'int' })
  actualQty: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
