import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum';
import { AuditLog } from './entities/audit-log.entity';

export interface WriteAuditInput {
  userId?: string | null;
  role?: UserRole | null;
  action: string;
  resource: string;
  entityId?: string | null;
  method: string;
  path: string;
  requestId?: string | null;
  payload?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
  ) {}

  async write(input: WriteAuditInput): Promise<void> {
    await this.auditLogs.save(
      this.auditLogs.create({
        userId: input.userId ?? null,
        role: input.role ?? null,
        action: input.action,
        resource: input.resource,
        entityId: input.entityId ?? null,
        method: input.method,
        path: input.path,
        requestId: input.requestId ?? null,
        payload: input.payload ?? null,
      }),
    );
  }

  findAuthHistory(userId: string, limit = 50): Promise<AuditLog[]> {
    return this.auditLogs.find({
      where: { userId, resource: 'auth' },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
