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
import { Supplier } from '../../products/entities/supplier.entity';
import { Item } from './item.entity';

export interface BatchDocument {
  name: string;
  url?: string;
  mimeType?: string;
  uploadedAt?: string;
}

@Entity('batches')
@Index('IDX_batches_supplier_id', ['supplierId'])
@Index('IDX_batches_received_at', ['receivedAt'])
export class Batch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Supplier, (supplier) => supplier.batches, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ name: 'supplier_id', type: 'uuid' })
  supplierId: string;

  @Column({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  documents: BatchDocument[];

  @OneToMany(() => Item, (item) => item.batch)
  items: Item[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
