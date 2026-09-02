import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '../../../prisma/generated/prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_ERROR';
    let message = 'Database error';

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          errorCode = 'CONFLICT';
          message = `Duplicate: ${(exception.meta?.target as string[])?.join(', ')} already exists.`;
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          errorCode = 'NOT_FOUND';
          message = 'Record not found.';
          break;
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          errorCode = 'VALIDATION_ERROR';
          message = 'Invalid reference — related record does not exist.';
          break;
        default:
          this.logger.error(
            `Prisma [${exception.code}]: ${exception.message}`,
            undefined,
            `${req.method} ${req.url}`,
          );
      }
    } else {
      status = HttpStatus.BAD_REQUEST;
      errorCode = 'VALIDATION_ERROR';
      message = 'Invalid data passed to the database.';
      this.logger.warn(exception.message);
    }

    res.status(status).json({
      success: false,
      statusCode: status,
      errorCode,
      message,
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }
}
