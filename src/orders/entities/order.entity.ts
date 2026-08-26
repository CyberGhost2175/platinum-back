import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { OrderItem } from './order-item.entity';

export interface OrderDeliveryInfo {
  method?: 'pickup' | 'courier' | 'post';
  address?: string;
  city?: string;
  postalCode?: string;
  recipientName?: string;
  recipientPhone?: string;
  comment?: string;
}

export interface OrderPaymentInfo {
  method?: 'card' | 'invoice' | 'on_delivery';
  status?: 'pending' | 'paid' | 'refunded' | 'failed';
  provider?: string;
  externalId?: string;
  paidAt?: string;
}

@Entity('orders')
@Index('IDX_orders_customer_id', ['customerId'])
@Index('IDX_orders_status_created_at', ['status', 'createdAt'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Customer, (customer) => customer.orders, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    enumName: 'order_status',
    default: OrderStatus.NEW,
  })
  status: OrderStatus;

  /** Order total in kopecks. */
  @Column({ name: 'total_amount', type: 'bigint', default: 0 })
  totalAmount: string;

  @Column({ name: 'delivery_info', type: 'jsonb', nullable: true })
  deliveryInfo: OrderDeliveryInfo | null;

  @Column({ name: 'payment_info', type: 'jsonb', nullable: true })
  paymentInfo: OrderPaymentInfo | null;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
