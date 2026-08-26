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
import { Location } from '../../locations/entities/location.entity';
import { Product } from '../../products/entities/product.entity';
import { ItemStatus } from '../enums/item-status.enum';
import { Batch } from './batch.entity';
import { ItemAuditLog } from './item-audit-log.entity';

@Entity('items')
@Index('UQ_items_unique_tag', ['uniqueTag'], { unique: true })
@Index('IDX_items_product_id', ['productId'])
@Index('IDX_items_location_id', ['locationId'])
@Index('IDX_items_batch_id', ['batchId'])
@Index('IDX_items_status', ['status'])
@Index('IDX_items_product_id_status', ['productId', 'status'])
export class Item {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Unique physical tag / label. Scan key. */
  @Column({ name: 'unique_tag', length: 64 })
  uniqueTag: string;

  @ManyToOne(() => Product, (product) => product.items, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Location, (location) => location.items, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @ManyToOne(() => Batch, (batch) => batch.items, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'batch_id' })
  batch: Batch | null;

  @Column({ name: 'batch_id', type: 'uuid', nullable: true })
  batchId: string | null;

  @Column({
    type: 'enum',
    enum: ItemStatus,
    enumName: 'item_status',
  })
  status: ItemStatus;

  @OneToMany(() => ItemAuditLog, (log) => log.item)
  history: ItemAuditLog[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
