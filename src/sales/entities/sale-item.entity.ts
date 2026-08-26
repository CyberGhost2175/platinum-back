import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Item } from '../../inventory/entities/item.entity';
import { Product } from '../../products/entities/product.entity';
import { Sale } from './sale.entity';

@Entity('sale_items')
@Index('IDX_sale_items_sale_id', ['saleId'])
@Index('IDX_sale_items_product_id', ['productId'])
@Index('IDX_sale_items_item_id', ['itemId'])
@Check('CHK_sale_items_qty_positive', '"qty" > 0')
export class SaleItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Sale, (sale) => sale.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @Column({ name: 'sale_id', type: 'uuid' })
  saleId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Item, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'item_id' })
  item: Item | null;

  @Column({ name: 'item_id', type: 'uuid', nullable: true })
  itemId: string | null;

  @Column({ type: 'int', default: 1 })
  qty: number;

  /** Unit price at the moment of sale, kopecks. */
  @Column({ type: 'bigint' })
  price: string;

  @Column({ type: 'bigint', default: 0 })
  discount: string;

  @Column({ name: 'discount_percent', type: 'int', default: 0 })
  discountPercent: number;

  @Column({ name: 'promo_code', type: 'varchar', length: 64, nullable: true })
  promoCode: string | null;

  /** qty * price - discounts, kopecks. */
  @Column({ name: 'line_total', type: 'bigint' })
  lineTotal: string;
}
