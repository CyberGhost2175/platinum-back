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
import { UserRole } from '../../common/enums/user-role.enum';
import { Location } from '../../locations/entities/location.entity';
import { UserStatus } from '../enums/user-status.enum';
import { Sale } from '../../sales/entities/sale.entity';
import { Shift } from '../../shifts/entities/shift.entity';
import { StockCheck } from '../../inventory/entities/stock-check.entity';

@Entity('users')
@Index('IDX_users_location_id', ['locationId'])
@Index('IDX_users_role', ['role'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    enumName: 'user_role',
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    enumName: 'user_status',
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone: string | null;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ name: 'password_hash', select: false })
  passwordHash: string;

  @Column({ name: 'totp_secret', type: 'varchar', nullable: true, select: false })
  totpSecret: string | null;

  @Column({ name: 'totp_enabled', default: false })
  totpEnabled: boolean;

  @ManyToOne(() => Location, (location) => location.users, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'location_id' })
  location: Location | null;

  @Column({ name: 'location_id', type: 'uuid', nullable: true })
  locationId: string | null;

  @OneToMany(() => Sale, (sale) => sale.seller)
  sales: Sale[];

  @OneToMany(() => Shift, (shift) => shift.cashier)
  shifts: Shift[];

  @OneToMany(() => StockCheck, (stockCheck) => stockCheck.responsibleUser)
  stockChecks: StockCheck[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
