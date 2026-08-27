import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { Env } from '../../config/env.validation';
import { applyCorsHeaders, parseCorsOrigins } from '../cors-origins';

export interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
  requestId: string | null;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    applyCorsHeaders(
      response,
      request.headers.origin,
      new Set(parseCorsOrigins(this.config.get('CORS_ORIGINS', { infer: true }))),
    );

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const { error, message } = this.extractError(exception, status);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
      );
    }

    const body: ErrorResponseBody = {
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.originalUrl ?? request.url,
      requestId: request.requestId ?? null,
    };

    response.status(status).json(body);
  }

  private extractError(
    exception: unknown,
    status: number,
  ): { error: string; message: string | string[] } {
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        return { error: exception.name, message: payload };
      }
      if (payload && typeof payload === 'object') {
        const body = payload as Record<string, unknown>;
        return {
          error: typeof body.error === 'string' ? body.error : exception.name,
          message:
            typeof body.message === 'string' || Array.isArray(body.message)
              ? (body.message as string | string[])
              : exception.message,
        };
      }
    }

    if (exception instanceof Error) {
      return {
        error: status >= 500 ? 'Internal Server Error' : exception.name,
        message:
          status >= 500 ? 'Internal server error' : exception.message,
      };
    }

    return { error: 'Internal Server Error', message: 'Internal server error' };
  }
}
