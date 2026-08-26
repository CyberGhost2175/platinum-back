import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../../audit/audit.service';
import { AUDIT_LOG_KEY } from '../decorators/audit-log.decorator';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const resource = this.reflector.getAllAndOverride<string>(AUDIT_LOG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();

    if (!resource || !MUTATING.has(request.method.toUpperCase())) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (responseBody) => {
          void this.persist(request, resource, responseBody);
        },
      }),
    );
  }

  private async persist(
    request: Request,
    resource: string,
    responseBody: unknown,
  ): Promise<void> {
    try {
      const entityId = this.extractEntityId(request, responseBody);
      const body = this.sanitize(request.body);
      await this.auditService.write({
        userId: request.user?.id ?? null,
        role: request.user?.role ?? null,
        action: `${request.method.toUpperCase()} ${resource}`,
        resource,
        entityId,
        method: request.method.toUpperCase(),
        path: request.originalUrl ?? request.url,
        requestId: request.requestId ?? null,
        payload: {
          params: request.params,
          query: request.query,
          body,
        },
      });
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.stack : error,
        'Failed to write audit log',
      );
    }
  }

  private extractEntityId(
    request: Request,
    responseBody: unknown,
  ): string | null {
    if (typeof request.params?.id === 'string') {
      return request.params.id;
    }
    if (
      responseBody &&
      typeof responseBody === 'object' &&
      'id' in responseBody &&
      typeof (responseBody as { id: unknown }).id === 'string'
    ) {
      return (responseBody as { id: string }).id;
    }
    return null;
  }

  private sanitize(body: unknown): Record<string, unknown> | null {
    if (!body || typeof body !== 'object') {
      return null;
    }
    const clone = { ...(body as Record<string, unknown>) };
    for (const key of Object.keys(clone)) {
      if (/password|secret|token|totp/i.test(key)) {
        clone[key] = '[redacted]';
      }
    }
    return clone;
  }
}
