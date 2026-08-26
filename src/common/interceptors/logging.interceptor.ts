import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();
    const { method, originalUrl } = request;
    const requestId = request.requestId ?? '-';

    return next.handle().pipe(
      tap({
        next: () => {
          const elapsedMs = Date.now() - startedAt;
          this.logger.log(
            `${method} ${originalUrl} ${response.statusCode} ${elapsedMs}ms requestId=${requestId}`,
          );
        },
        error: (error: unknown) => {
          const elapsedMs = Date.now() - startedAt;
          const status =
            error && typeof error === 'object' && 'status' in error
              ? (error as { status: number }).status
              : 500;
          this.logger.warn(
            `${method} ${originalUrl} ${status} ${elapsedMs}ms requestId=${requestId}`,
          );
        },
      }),
    );
  }
}
