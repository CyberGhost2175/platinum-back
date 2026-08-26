import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ItemAuditAction } from '../enums/item-audit-action.enum';
import { ItemStatus } from '../enums/item-status.enum';
import { Item } from './item.entity';

@Entity('item_audit_logs')
@Index('IDX_item_audit_logs_item_id', ['itemId'])
@Index('IDX_item_audit_logs_item_id_created_at', ['itemId', 'createdAt'])
export class ItemAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Item, (item) => item.history, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @Column({
    type: 'enum',
    enum: ItemAuditAction,
    enumName: 'item_audit_action',
  })
  action: ItemAuditAction;

  @Column({
    name: 'from_status',
    type: 'enum',
    enum: ItemStatus,
    enumName: 'item_status',
    nullable: true,
  })
  fromStatus: ItemStatus | null;

  @Column({
    name: 'to_status',
    type: 'enum',
    enum: ItemStatus,
    enumName: 'item_status',
    nullable: true,
  })
  toStatus: ItemStatus | null;

  @Column({ name: 'from_location_id', type: 'uuid', nullable: true })
  fromLocationId: string | null;

  @Column({ name: 'to_location_id', type: 'uuid', nullable: true })
  toLocationId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_user_id' })
  actor: User | null;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
