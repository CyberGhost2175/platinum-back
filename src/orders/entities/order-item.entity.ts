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
import { Order } from './order.entity';

@Entity('order_items')
@Index('IDX_order_items_order_id', ['orderId'])
@Index('IDX_order_items_product_id', ['productId'])
@Index('IDX_order_items_item_id', ['itemId'])
@Check('CHK_order_items_qty_positive', '"qty" > 0')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

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

  @Column({ type: 'bigint' })
  price: string;

  @Column({ name: 'line_total', type: 'bigint' })
  lineTotal: string;
}
