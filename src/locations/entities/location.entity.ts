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
import { LocationType } from '../enums/location-type.enum';
import { User } from '../../users/entities/user.entity';
import { Item } from '../../inventory/entities/item.entity';
import { Sale } from '../../sales/entities/sale.entity';
import { Shift } from '../../shifts/entities/shift.entity';
import { StockCheck } from '../../inventory/entities/stock-check.entity';

@Entity('locations')
@Index('IDX_locations_parent_id', ['parentId'])
@Index('IDX_locations_type', ['type'])
export class Location {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: LocationType,
    enumName: 'location_type',
  })
  type: LocationType;

  @Column()
  name: string;

  @ManyToOne(() => Location, (location) => location.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_id' })
  parent: Location | null;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @OneToMany(() => Location, (location) => location.parent)
  children: Location[];

  @OneToMany(() => User, (user) => user.location)
  users: User[];

  @OneToMany(() => Item, (item) => item.location)
  items: Item[];

  @OneToMany(() => Sale, (sale) => sale.location)
  sales: Sale[];

  @OneToMany(() => Shift, (shift) => shift.location)
  shifts: Shift[];

  @OneToMany(() => StockCheck, (stockCheck) => stockCheck.location)
  stockChecks: StockCheck[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
