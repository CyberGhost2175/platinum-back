import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { Sale } from '../../sales/entities/sale.entity';

@Entity('customers')
@Index('IDX_customers_phone', ['phone'])
@Index('IDX_customers_email', ['email'])
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ name: 'loyalty_points', type: 'int', default: 0 })
  loyaltyPoints: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => Sale, (sale) => sale.customer)
  purchaseHistory: Sale[];

  @OneToMany(() => Order, (order) => order.customer)
  orders: Order[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
