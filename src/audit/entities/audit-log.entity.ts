import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../users/entities/user.entity';

@Entity('audit_logs')
@Index('IDX_audit_logs_user_id', ['userId'])
@Index('IDX_audit_logs_resource_created_at', ['resource', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  role: UserRole | null;

  @Column()
  action: string;

  @Column()
  resource: string;

  @Column({ name: 'entity_id', type: 'varchar', nullable: true })
  entityId: string | null;

  @Column()
  method: string;

  @Column()
  path: string;

  @Column({ name: 'request_id', type: 'varchar', nullable: true })
  requestId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
