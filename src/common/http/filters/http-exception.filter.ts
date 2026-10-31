import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../../../prisma/generated/prisma/client';
import { ApiResponses } from '../api-responses';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = codes[status] ?? 'HTTP_ERROR';
      const body = exception.getResponse();
      if (typeof body === 'string') message = body;
      else {
        const value = body as { message?: string | string[] };
        if (Array.isArray(value.message)) {
          message = 'Validation failed';
          details = value.message;
          code = 'VALIDATION_ERROR';
        } else message = value.message ?? exception.message;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = prismaErrors[exception.code];
      if (mapped) [status, code, message] = mapped;
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      code = 'VALIDATION_ERROR';
      message = 'Invalid data passed to the database';
    }
    // Never expose SQL, credentials, stacks, or raw database messages to clients.
    if (status >= 500) {
      this.logger.error(
        `[${String(res.locals.requestId)}] ${req.method} ${req.path}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      // Deliberate 503 responses explain unavailable optional capabilities.
      if (!(exception instanceof HttpException && status === HttpStatus.SERVICE_UNAVAILABLE)) {
        message = 'An unexpected error occurred';
      }
      details = undefined;
    }
    res.status(status).json(
      ApiResponses.error(message, {
        code,
        statusCode: status,
        details,
        traceId: res.locals.requestId as string | undefined,
      }),
    );
  }
}

const codes: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'TOO_MANY_REQUESTS',
  503: 'UNAVAILABLE',
};
const prismaErrors: Record<string, [number, string, string]> = {
  P2002: [409, 'CONFLICT', 'A record with these unique fields already exists'],
  P2025: [404, 'NOT_FOUND', 'Record not found'],
  P2003: [400, 'VALIDATION_ERROR', 'Related record does not exist'],
};
