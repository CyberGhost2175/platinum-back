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
import { Location } from '../../locations/entities/location.entity';
import { Sale } from '../../sales/entities/sale.entity';
import { User } from '../../users/entities/user.entity';
import { ShiftStatus } from '../enums/shift-status.enum';

@Entity('shifts')
@Index('IDX_shifts_cashier_id_status', ['cashierId', 'status'])
@Index('IDX_shifts_location_id', ['locationId'])
@Index('UQ_shifts_one_open_per_cashier', ['cashierId'], {
  unique: true,
  where: `"status" = 'open'`,
})
export class Shift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.shifts, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cashier_id' })
  cashier: User;

  @Column({ name: 'cashier_id', type: 'uuid' })
  cashierId: string;

  @ManyToOne(() => Location, (location) => location.shifts, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @Column({
    type: 'enum',
    enum: ShiftStatus,
    enumName: 'shift_status',
    default: ShiftStatus.OPEN,
  })
  status: ShiftStatus;

  @Column({ name: 'opened_at', type: 'timestamptz' })
  openedAt: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  /** Running cash total in kopecks. */
  @Column({ name: 'cash_total', type: 'bigint', default: 0 })
  cashTotal: string;

  /** Running card total in kopecks. */
  @Column({ name: 'card_total', type: 'bigint', default: 0 })
  cardTotal: string;

  @OneToMany(() => Sale, (sale) => sale.shift)
  sales: Sale[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
