import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        errorCode = (b.errorCode as string) ?? codeFor(status);
        message = Array.isArray(b.message)
          ? 'Validation failed'
          : ((b.message as string) ?? message);
        details = Array.isArray(b.message) ? b.message : b.details;
        if (Array.isArray(b.message)) errorCode = 'VALIDATION_ERROR';
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack, `${req.method} ${req.url}`);
    }

    res.status(status).json({
      success: false,
      statusCode: status,
      errorCode,
      message,
      details: details ?? undefined,
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }
}

function codeFor(status: HttpStatus): string {
  const m: Partial<Record<HttpStatus, string>> = {
    [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
    [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
    [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
    [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
    [HttpStatus.CONFLICT]: 'CONFLICT',
    [HttpStatus.PAYMENT_REQUIRED]: 'PREMIUM_REQUIRED',
    [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
  };
  return m[status] ?? 'INTERNAL_ERROR';
}
