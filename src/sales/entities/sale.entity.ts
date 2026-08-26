import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { Location } from '../../locations/entities/location.entity';
import { Shift } from '../../shifts/entities/shift.entity';
import { User } from '../../users/entities/user.entity';
import { PaymentMethod } from '../enums/payment-method.enum';
import { SaleChannel } from '../enums/sale-channel.enum';
import { SaleStatus } from '../enums/sale-status.enum';
import { SaleItem } from './sale-item.entity';

@Entity('sales')
@Index('UQ_sales_receipt_number', ['receiptNumber'], {
  unique: true,
  where: '"receipt_number" IS NOT NULL',
})
@Index('IDX_sales_shift_id', ['shiftId'])
@Index('IDX_sales_location_id', ['locationId'])
@Index('IDX_sales_seller_id', ['sellerId'])
@Index('IDX_sales_customer_id', ['customerId'])
@Index('IDX_sales_channel_date', ['channel', 'date'])
@Index('IDX_sales_status', ['status'])
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamptz' })
  date: Date;

  @Column({ name: 'receipt_number', type: 'varchar', length: 64, nullable: true })
  receiptNumber: string | null;

  @ManyToOne(() => Location, (location) => location.sales, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @ManyToOne(() => User, (user) => user.sales, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'seller_id' })
  seller: User;

  @Column({ name: 'seller_id', type: 'uuid' })
  sellerId: string;

  @ManyToOne(() => Shift, (shift) => shift.sales, { nullable: true })
  @JoinColumn({ name: 'shift_id' })
  shift: Shift | null;

  @Column({ name: 'shift_id', type: 'uuid', nullable: true })
  shiftId: string | null;

  @ManyToOne(() => Customer, (customer) => customer.purchaseHistory, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId: string | null;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
    enumName: 'payment_method',
    nullable: true,
  })
  paymentMethod: PaymentMethod | null;

  @Column({
    type: 'enum',
    enum: SaleChannel,
    enumName: 'sale_channel',
  })
  channel: SaleChannel;

  @Column({
    type: 'enum',
    enum: SaleStatus,
    enumName: 'sale_status',
    default: SaleStatus.DRAFT,
  })
  status: SaleStatus;

  @Column({ name: 'promo_code', type: 'varchar', length: 64, nullable: true })
  promoCode: string | null;

  @Column({ name: 'discount_percent', type: 'int', default: 0 })
  discountPercent: number;

  /** Discount in kopecks. */
  @Column({ type: 'bigint', default: 0 })
  discount: string;

  /** Receipt total in kopecks after discount. */
  @Column({ name: 'total_amount', type: 'bigint', default: 0 })
  totalAmount: string;

  @ManyToOne(() => Sale, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'original_sale_id' })
  originalSale: Sale | null;

  @Column({ name: 'original_sale_id', type: 'uuid', nullable: true })
  originalSaleId: string | null;

  @OneToMany(() => SaleItem, (item) => item.sale, { cascade: true })
  items: SaleItem[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
