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
import { User } from '../../users/entities/user.entity';
import { StockCheckDiscrepancy } from './stock-check-discrepancy.entity';

@Entity('stock_checks')
@Index('IDX_stock_checks_location_id', ['locationId'])
@Index('IDX_stock_checks_date', ['date'])
@Index('IDX_stock_checks_responsible_user_id', ['responsibleUserId'])
export class StockCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamptz' })
  date: Date;

  @ManyToOne(() => Location, (location) => location.stockChecks, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @ManyToOne(() => User, (user) => user.stockChecks, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'responsible_user_id' })
  responsibleUser: User;

  @Column({ name: 'responsible_user_id', type: 'uuid' })
  responsibleUserId: string;

  @OneToMany(() => StockCheckDiscrepancy, (row) => row.stockCheck, {
    cascade: true,
  })
  discrepancies: StockCheckDiscrepancy[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
